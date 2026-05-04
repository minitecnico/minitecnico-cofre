import { supabase } from './supabase';

/**
 * TransactionService — wrapper sobre o cliente Supabase.
 * --------------------------------------------------------------
 * RLS garante que cada usuário só vê suas próprias transações,
 * então não precisamos passar user_id manualmente nos selects.
 *
 * No insert SIM precisamos: o supabase exige user_id pelo policy "with check".
 */

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

export const transactionService = {
  async list(filters = {}) {
    let query = supabase
      .from('transactions')
      .select(`
        *,
        category:categories ( id, name, color, icon, type ),
        credit_card:credit_cards ( id, name, color )
      `)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.type) query = query.eq('type', filters.type);
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
    if (filters.creditCardId) query = query.eq('credit_card_id', filters.creditCardId);
    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate) query = query.lte('date', filters.endDate);

    if (filters.limit) query = query.limit(filters.limit);

    const { data, error, count } = await query;
    if (error) throw error;
    return { transactions: data || [], total: count || data?.length || 0 };
  },

  async create(payload) {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: payload.type,
        amount: payload.amount,
        description: payload.description,
        date: payload.date,
        category_id: payload.category_id,
        credit_card_id: payload.credit_card_id || null,
      })
      .select(`*, category:categories(*), credit_card:credit_cards(*)`)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Cria várias transações de uma vez (lançamento em massa).
   * Mais eficiente que N chamadas separadas: 1 só request, transação atômica.
   *
   * Cada item do array deve ter: type, amount, description, date, category_id,
   * e opcionalmente credit_card_id.
   *
   * Retorna a quantidade criada.
   */
  async createBatch(items) {
    if (!items || items.length === 0) return { count: 0, transactions: [] };

    const userId = await currentUserId();
    const rows = items.map((item) => ({
      user_id: userId,
      type: item.type,
      amount: item.amount,
      description: item.description,
      date: item.date,
      category_id: item.category_id,
      credit_card_id: item.credit_card_id || null,
      paid: item.type === 'income', // receita já vem como recebida
    }));

    const { data, error } = await supabase
      .from('transactions')
      .insert(rows)
      .select(`*, category:categories(*), credit_card:credit_cards(*)`);
    if (error) throw error;
    return { count: data?.length || 0, transactions: data || [] };
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('transactions')
      .update({
        type: payload.type,
        amount: payload.amount,
        description: payload.description,
        date: payload.date,
        category_id: payload.category_id,
        credit_card_id: payload.credit_card_id || null,
      })
      .eq('id', id)
      .select(`*, category:categories(*), credit_card:credit_cards(*)`)
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Remove TODAS as parcelas de uma compra (mesmo installment_group_id).
   */
  async removeGroup(groupId) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('installment_group_id', groupId);
    if (error) throw error;
  },

  /**
   * Cria uma compra parcelada — N transações com mesmo installment_group_id.
   * Cada parcela é independente (cai no mês correspondente, pode ser editada
   * separadamente). O groupId conecta todas para edição/exclusão em massa.
   *
   * @param {Object} payload - dados da compra (sem amount/date — calculados aqui)
   * @param {number} payload.totalAmount - valor TOTAL da compra
   * @param {number} payload.installmentCount - número de parcelas (>= 2)
   * @param {string} payload.startDate - data da primeira parcela (YYYY-MM-DD)
   * @param {string} payload.description - descrição (vai virar "X (1/N)", "X (2/N)"...)
   */
  async createInstallments(payload) {
    const { generateInstallmentDates, splitInstallmentAmount } = await import('../utils/format');
    const userId = await currentUserId();

    const { totalAmount, installmentCount, startDate, description, ...rest } = payload;

    if (installmentCount < 2) throw new Error('Use create() para 1 parcela');

    const dates = generateInstallmentDates(startDate, installmentCount);
    const amounts = splitInstallmentAmount(totalAmount, installmentCount);

    // Gera UUID no cliente — o Postgres aceita
    const groupId = crypto.randomUUID();

    const rows = dates.map((date, i) => ({
      user_id: userId,
      type: rest.type,
      amount: amounts[i],
      description: `${description} (${i + 1}/${installmentCount})`,
      date,
      category_id: rest.category_id,
      credit_card_id: rest.credit_card_id || null,
      installment_total: installmentCount,
      installment_number: i + 1,
      installment_group_id: groupId,
      paid: false,
    }));

    const { data, error } = await supabase.from('transactions').insert(rows).select();
    if (error) throw error;
    return { groupId, transactions: data };
  },

  /**
   * Alterna o status de pagamento de uma despesa.
   * Atualização otimista: o frontend já reflete a mudança antes da resposta.
   */
  async togglePaid(id, paid) {
    const { data, error } = await supabase
      .from('transactions')
      .update({ paid })
      .eq('id', id)
      .select(`*, category:categories(*), credit_card:credit_cards(*)`)
      .single();
    if (error) throw error;
    return data;
  },
};

export const categoryService = {
  async list(type) {
    let query = supabase.from('categories').select('*').order('name');
    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async create(payload) {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: userId, ...payload })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('categories')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
  },
};

export const cardService = {
  async list() {
    const { data, error } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('active', true)
      .order('created_at');
    if (error) throw error;

    // Enriquecer com summary (fatura, disponível) via RPC para cada cartão
    const enriched = await Promise.all(
      (data || []).map(async (card) => {
        const { data: summary } = await supabase.rpc('get_card_summary', {
          p_card_id: card.id,
        });
        const s = summary?.[0] || {};
        return {
          card,
          available: Number(s.available || card.card_limit),
          currentBill: Number(s.current_bill || 0),
          totalUsed: Number(s.total_used || 0),
          purchaseCount: Number(s.purchase_count || 0),
          cycleStart: s.cycle_start,
          cycleEnd: s.cycle_end,
          utilizationPercent: Number(s.utilization_percent || 0),
        };
      })
    );

    return enriched;
  },

  async create(payload) {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from('credit_cards')
      .insert({
        user_id: userId,
        name: payload.name,
        brand: payload.brand,
        last_digits: payload.lastDigits || null,
        card_limit: payload.limit,
        closing_day: payload.closingDay,
        due_day: payload.dueDay,
        color: payload.color,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('credit_cards')
      .update({
        name: payload.name,
        brand: payload.brand,
        last_digits: payload.lastDigits || null,
        card_limit: payload.limit,
        closing_day: payload.closingDay,
        due_day: payload.dueDay,
        color: payload.color,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    // Soft delete — preserva histórico de transações
    const { error } = await supabase
      .from('credit_cards')
      .update({ active: false })
      .eq('id', id);
    if (error) throw error;
  },

  async history(cardId) {
    const { data, error } = await supabase
      .from('transactions')
      .select(`*, category:categories(*)`)
      .eq('credit_card_id', cardId)
      .order('date', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  },
};

/**
 * RecurringService — gerencia transações recorrentes (modelos).
 * --------------------------------------------------------------
 * Modelos = "templates" que geram transações reais nos meses.
 * O frontend chama generateForMonth() ao abrir um mês — a função SQL
 * cria as transações que faltam (idempotente, não duplica).
 */
export const recurringService = {
  async list() {
    const { data, error } = await supabase
      .from('recurring_transactions')
      .select(`*, category:categories(*), credit_card:credit_cards(*)`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(payload) {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from('recurring_transactions')
      .insert({
        user_id: userId,
        type: payload.type,
        amount: payload.amount,
        description: payload.description,
        category_id: payload.category_id,
        credit_card_id: payload.credit_card_id || null,
        day_of_month: payload.day_of_month,
        start_month: payload.start_month, // YYYY-MM-DD (dia 1 do mês de início)
        active: true,
      })
      .select(`*, category:categories(*), credit_card:credit_cards(*)`)
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('recurring_transactions')
      .update(payload)
      .eq('id', id)
      .select(`*, category:categories(*), credit_card:credit_cards(*)`)
      .single();
    if (error) throw error;
    return data;
  },

  async toggleActive(id, active) {
    const { error } = await supabase
      .from('recurring_transactions')
      .update({ active })
      .eq('id', id);
    if (error) throw error;
  },

  async remove(id) {
    const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Gera as transações recorrentes do mês informado.
   * Idempotente: se já tiverem sido geradas, não duplica.
   * Retorna quantas foram criadas (0 = nada novo).
   */
  async generateForMonth(month) {
    const { data, error } = await supabase.rpc('generate_recurring_for_month', { p_month: month });
    if (error) throw error;
    return data || 0;
  },
};

/**
 * DashboardService — usa as RPC functions criadas no schema.sql
 * Aceita mês de referência ('YYYY-MM') para todas as agregações.
 */
export const dashboardService = {
  async summary(period = 'month', referenceMonth = null) {
    // Calcula mês anterior pra comparação
    const previousMonth = (() => {
      if (!referenceMonth) {
        // Se não passou mês de referência, usa o atual
        const now = new Date();
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
      }
      const [y, m] = referenceMonth.split('-').map(Number);
      const prev = new Date(y, m - 2, 1); // m-2: getMonth é 0-indexed e queremos -1 mês
      return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    })();

    const [balance, periodSummary, byCategory, monthlyHistory, previousBalance] = await Promise.all([
      supabase.rpc('get_balance', { p_month: referenceMonth }).then((r) => r.data?.[0] || { balance: 0, total_income: 0, total_expense: 0 }),
      supabase.rpc('get_period_summary', { p_period: period, p_reference: referenceMonth }).then((r) => r.data?.[0] || { income: 0, expense: 0, balance: 0, tx_count: 0 }),
      supabase.rpc('get_expenses_by_category', { p_month: referenceMonth }).then((r) => r.data || []),
      supabase.rpc('get_monthly_history', { p_months: 6 }).then((r) => r.data || []),
      supabase.rpc('get_balance', { p_month: previousMonth }).then((r) => r.data?.[0] || { balance: 0, total_income: 0, total_expense: 0 }),
    ]);
    // Normaliza pra estrutura que o frontend já consome
    const balanceObj = {
      balance: Number(balance.balance) || 0,
      totalIncome: Number(balance.total_income) || 0,
      totalExpense: Number(balance.total_expense) || 0,
    };
    const periodObj = {
      period,
      income: Number(periodSummary.income) || 0,
      expense: Number(periodSummary.expense) || 0,
      balance: Number(periodSummary.balance) || 0,
      count: Number(periodSummary.tx_count) || 0,
    };

    // Comparação com mês anterior — calcula variações em %
    const prevIncome = Number(previousBalance.total_income) || 0;
    const prevExpense = Number(previousBalance.total_expense) || 0;
    const prevBalanceVal = Number(previousBalance.balance) || 0;

    function pctChange(current, previous) {
      if (previous === 0) return null; // não tem como comparar com zero
      return ((current - previous) / Math.abs(previous)) * 100;
    }

    const comparison = {
      incomeChange: pctChange(periodObj.income, prevIncome),
      expenseChange: pctChange(periodObj.expense, prevExpense),
      balanceChange: pctChange(balanceObj.balance, prevBalanceVal),
      previous: {
        income: prevIncome,
        expense: prevExpense,
        balance: prevBalanceVal,
      },
    };

    const alerts = [];
    if (periodObj.income > 0 && periodObj.expense > periodObj.income * 0.8) {
      alerts.push({
        type: 'warning',
        message: `Despesas representam ${Math.round(
          (periodObj.expense / periodObj.income) * 100
        )}% das receitas neste período.`,
      });
    }
    if (balanceObj.balance < 0) {
      alerts.push({ type: 'danger', message: 'Saldo negativo! Reveja seus gastos.' });
    }

    return {
      balance: balanceObj,
      periodSummary: periodObj,
      comparison,
      byCategory: byCategory.map((c) => ({
        categoryId: c.category_id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        total: Number(c.total) || 0,
        count: Number(c.tx_count) || 0,
      })),
      monthlyHistory: monthlyHistory.map((m) => ({
        month: m.month,
        income: Number(m.income) || 0,
        expense: Number(m.expense) || 0,
        balance: Number(m.balance) || 0,
      })),
      alerts,
    };
  },

  async forecast(months = 3) {
    const { data, error } = await supabase.rpc('get_balance_forecast', { p_months: months });
    if (error) throw error;
    const balance = await supabase.rpc('get_balance').then((r) => r.data?.[0]);
    return {
      current: Number(balance?.balance) || 0,
      forecast: (data || []).map((f) => ({
        month: f.month,
        projected: Number(f.projected) || 0,
        avgIncome: Number(f.avg_income) || 0,
        avgExpense: Number(f.avg_expense) || 0,
      })),
    };
  },

  async recent(limit = 10) {
    const { transactions } = await transactionService.list({ limit });
    return transactions;
  },

  /**
   * Exporta CSV no próprio cliente — sem precisar de backend.
   * Busca as transações com os mesmos filtros e gera o CSV em memória.
   */
  async exportCSV(filters = {}) {
    const { transactions } = await transactionService.list({ ...filters, limit: 10000 });

    const header = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor (R$)', 'Cartão'];
    const rows = transactions.map((t) => {
      const dateBr = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
      return [
        dateBr,
        t.type === 'income' ? 'Receita' : 'Despesa',
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.category?.name || '',
        Number(t.amount).toFixed(2).replace('.', ','),
        t.credit_card?.name || '',
      ].join(';');
    });

    // BOM para Excel reconhecer UTF-8
    return '\ufeff' + [header.join(';'), ...rows].join('\n');
  },
};
