import { supabase } from './supabase';

/**
 * BackupService — exporta e importa todos os dados do usuário em JSON.
 * --------------------------------------------------------------
 * Útil para:
 *  - Migrar entre projetos Supabase
 *  - Ter cópia de segurança fora do banco (Drive, e-mail)
 *  - Recuperar de exclusão acidental
 *
 * O JSON é versionado (campo "version") para permitir migrações futuras.
 *
 * O backup NÃO inclui:
 *  - Senha (por segurança)
 *  - IDs do banco (são regerados na importação para evitar conflito)
 *
 * Reimporta de forma idempotente: detecta dados existentes pela combinação
 * descrição + data + valor e ignora duplicatas.
 */
export const backupService = {
  async export() {
    // Busca todos os dados em paralelo
    const [categoriesRes, cardsRes, recurringRes, transactionsRes] = await Promise.all([
      supabase.from('categories').select('*'),
      supabase.from('credit_cards').select('*'),
      supabase.from('recurring_transactions').select('*'),
      supabase.from('transactions').select('*'),
    ]);

    if (categoriesRes.error) throw categoriesRes.error;
    if (cardsRes.error) throw cardsRes.error;
    if (recurringRes.error) throw recurringRes.error;
    if (transactionsRes.error) throw transactionsRes.error;

    return {
      version: 1,
      exported_at: new Date().toISOString(),
      categories: categoriesRes.data || [],
      credit_cards: cardsRes.data || [],
      recurring_transactions: recurringRes.data || [],
      transactions: transactionsRes.data || [],
    };
  },

  /**
   * Importa um backup. Por padrão é "merge" — adiciona o que não existe.
   * Pra reimportar limpando tudo antes, passe { clearBefore: true }.
   *
   * Retorna estatísticas: quantos foram importados de cada tipo.
   */
  async import(json, { clearBefore = false } = {}) {
    if (!json || json.version !== 1) {
      throw new Error('Arquivo de backup inválido ou de versão incompatível.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user.id;

    const stats = { categories: 0, cards: 0, recurring: 0, transactions: 0, skipped: 0 };

    if (clearBefore) {
      // Apaga em ordem por causa das foreign keys
      await supabase.from('transactions').delete().eq('user_id', userId);
      await supabase.from('recurring_transactions').delete().eq('user_id', userId);
      await supabase.from('credit_cards').delete().eq('user_id', userId);
      await supabase.from('categories').delete().eq('user_id', userId);
    }

    // Mapeia IDs antigos → novos (categorias e cartões são referenciados)
    const categoryIdMap = new Map();
    const cardIdMap = new Map();
    const recurringIdMap = new Map();

    // 1. Categorias
    if (json.categories?.length > 0) {
      // Verifica quais já existem (pelo nome+tipo, que é unique)
      const { data: existing } = await supabase
        .from('categories')
        .select('id, name, type')
        .eq('user_id', userId);
      const existingMap = new Map(
        (existing || []).map((c) => [`${c.name}::${c.type}`, c.id])
      );

      for (const cat of json.categories) {
        const key = `${cat.name}::${cat.type}`;
        if (existingMap.has(key)) {
          // Já existe — só mapeia o ID
          categoryIdMap.set(cat.id, existingMap.get(key));
          stats.skipped++;
        } else {
          const { data, error } = await supabase
            .from('categories')
            .insert({
              user_id: userId,
              name: cat.name,
              type: cat.type,
              color: cat.color,
              icon: cat.icon,
            })
            .select('id')
            .single();
          if (error) throw error;
          categoryIdMap.set(cat.id, data.id);
          stats.categories++;
        }
      }
    }

    // 2. Cartões
    if (json.credit_cards?.length > 0) {
      for (const card of json.credit_cards) {
        const { data, error } = await supabase
          .from('credit_cards')
          .insert({
            user_id: userId,
            name: card.name,
            brand: card.brand,
            last_digits: card.last_digits,
            card_limit: card.card_limit,
            closing_day: card.closing_day,
            due_day: card.due_day,
            color: card.color,
            active: card.active !== false,
          })
          .select('id')
          .single();
        if (error) throw error;
        cardIdMap.set(card.id, data.id);
        stats.cards++;
      }
    }

    // 3. Recorrências
    if (json.recurring_transactions?.length > 0) {
      for (const rec of json.recurring_transactions) {
        const newCategoryId = categoryIdMap.get(rec.category_id);
        if (!newCategoryId) {
          stats.skipped++;
          continue; // categoria não foi importada (estranho)
        }
        const { data, error } = await supabase
          .from('recurring_transactions')
          .insert({
            user_id: userId,
            type: rec.type,
            amount: rec.amount,
            description: rec.description,
            category_id: newCategoryId,
            credit_card_id: rec.credit_card_id ? cardIdMap.get(rec.credit_card_id) : null,
            day_of_month: rec.day_of_month,
            start_month: rec.start_month,
            active: rec.active,
          })
          .select('id')
          .single();
        if (error) throw error;
        recurringIdMap.set(rec.id, data.id);
        stats.recurring++;
      }
    }

    // 4. Transações
    if (json.transactions?.length > 0) {
      // Detectar duplicatas: mesma data+descrição+valor já existem?
      const { data: existing } = await supabase
        .from('transactions')
        .select('date, description, amount')
        .eq('user_id', userId);
      const existingSet = new Set(
        (existing || []).map((t) => `${t.date}::${t.description}::${t.amount}`)
      );

      const rowsToInsert = [];
      for (const tx of json.transactions) {
        const key = `${tx.date}::${tx.description}::${tx.amount}`;
        if (existingSet.has(key)) {
          stats.skipped++;
          continue;
        }
        const newCategoryId = categoryIdMap.get(tx.category_id);
        if (!newCategoryId) {
          stats.skipped++;
          continue;
        }
        rowsToInsert.push({
          user_id: userId,
          type: tx.type,
          amount: tx.amount,
          description: tx.description,
          date: tx.date,
          category_id: newCategoryId,
          credit_card_id: tx.credit_card_id ? cardIdMap.get(tx.credit_card_id) : null,
          recurring_id: tx.recurring_id ? recurringIdMap.get(tx.recurring_id) : null,
          notes: tx.notes,
          installment_total: tx.installment_total || 1,
          installment_number: tx.installment_number || 1,
          installment_group_id: tx.installment_group_id || null,
          paid: tx.paid || false,
        });
      }

      // Insert em lotes de 500 (Supabase tem limite)
      for (let i = 0; i < rowsToInsert.length; i += 500) {
        const batch = rowsToInsert.slice(i, i + 500);
        const { error } = await supabase.from('transactions').insert(batch);
        if (error) throw error;
        stats.transactions += batch.length;
      }
    }

    return stats;
  },
};
