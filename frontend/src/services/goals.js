import { supabase } from './supabase';

/**
 * Service unificado para a página Objetivos:
 *   - Desafio 52 Semanas (weeklyChallengeService)
 *   - Metas / Goals (goalService)
 *   - Notas / Notes (noteService)
 *
 * Cada um é independente — não compartilham lógica nem afetam outros services.
 */

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Não autenticado');
  return data.user.id;
}

// ═════════════════════════════════════════════════════════════════════════
// DESAFIO 52 SEMANAS
// ═════════════════════════════════════════════════════════════════════════

export const weeklyChallengeService = {
  /** Pega o desafio ativo do usuário (ou null se não tem). */
  async getActive() {
    const { data, error } = await supabase
      .from('weekly_challenges')
      .select('*')
      .eq('active', true)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Cria um novo desafio (desativa o anterior se houver). */
  async create({ title, multiplier }) {
    const userId = await currentUserId();

    // Desativa qualquer desafio anterior (para evitar dois ativos)
    await supabase
      .from('weekly_challenges')
      .update({ active: false })
      .eq('user_id', userId)
      .eq('active', true);

    const { data, error } = await supabase
      .from('weekly_challenges')
      .insert({
        user_id: userId,
        title: title || 'Desafio 52 Semanas',
        multiplier: Number(multiplier) || 1,
        weeks_status: new Array(52).fill(false),
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /** Atualiza o status (paga / não paga) de UMA semana específica. */
  async toggleWeek(challengeId, weekIndex /* 0..51 */) {
    // Buscamos o array atual, alteramos só o índice e salvamos
    const { data: current, error: fetchErr } = await supabase
      .from('weekly_challenges')
      .select('weeks_status')
      .eq('id', challengeId)
      .single();
    if (fetchErr) throw fetchErr;

    const arr = [...(current.weeks_status || [])];
    while (arr.length < 52) arr.push(false);
    arr[weekIndex] = !arr[weekIndex];

    const { data, error } = await supabase
      .from('weekly_challenges')
      .update({ weeks_status: arr })
      .eq('id', challengeId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /** Atualiza configurações do desafio (título, multiplier). */
  async update(challengeId, payload) {
    const { data, error } = await supabase
      .from('weekly_challenges')
      .update(payload)
      .eq('id', challengeId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /** Reseta o desafio (zera todas as semanas). */
  async reset(challengeId) {
    const { data, error } = await supabase
      .from('weekly_challenges')
      .update({ weeks_status: new Array(52).fill(false) })
      .eq('id', challengeId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /** Remove o desafio de vez. */
  async remove(challengeId) {
    const { error } = await supabase
      .from('weekly_challenges')
      .delete()
      .eq('id', challengeId);
    if (error) throw error;
  },
};

// ═════════════════════════════════════════════════════════════════════════
// METAS / GOALS
// ═════════════════════════════════════════════════════════════════════════

export const goalService = {
  /** Lista todas as metas (não completadas primeiro, depois completadas). */
  async list() {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .order('completed', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(payload) {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: userId,
        title: payload.title,
        description: payload.description || null,
        target_amount: payload.target_amount,
        current_amount: payload.current_amount || 0,
        deadline: payload.deadline || null,
        color: payload.color || '#b8e94e',
        icon: payload.icon || 'target',
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('goals')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Adiciona um depósito à meta. Se o total atingir/passar o alvo,
   * marca como completed automaticamente.
   */
  async deposit(id, amount) {
    const { data: goal, error: fetchErr } = await supabase
      .from('goals')
      .select('current_amount, target_amount')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    const newAmount = Number(goal.current_amount || 0) + Number(amount);
    const completed = newAmount >= Number(goal.target_amount);

    const { data, error } = await supabase
      .from('goals')
      .update({ current_amount: newAmount, completed })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /** Retira valor da meta (caso o usuário desistir, etc). */
  async withdraw(id, amount) {
    const { data: goal, error: fetchErr } = await supabase
      .from('goals')
      .select('current_amount')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;

    const newAmount = Math.max(0, Number(goal.current_amount || 0) - Number(amount));
    const { data, error } = await supabase
      .from('goals')
      .update({ current_amount: newAmount, completed: false })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) throw error;
  },
};

// ═════════════════════════════════════════════════════════════════════════
// NOTAS / NOTES
// ═════════════════════════════════════════════════════════════════════════

export const noteService = {
  /** Lista todas as notas (pinned no topo, depois mais recentes primeiro). */
  async list() {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(payload) {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        title: payload.title || null,
        content: payload.content || '',
        pinned: payload.pinned || false,
        color: payload.color || '#fef3c7',
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /** Atualiza apenas o conteúdo. Usado pelo auto-save. */
  async updateContent(id, content) {
    const { data, error } = await supabase
      .from('notes')
      .update({ content })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('notes')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async togglePin(id, pinned) {
    const { error } = await supabase
      .from('notes')
      .update({ pinned })
      .eq('id', id);
    if (error) throw error;
  },

  async remove(id) {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) throw error;
  },
};
