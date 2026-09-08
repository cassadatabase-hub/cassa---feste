import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const ENTITY_TO_TABLE = {
  Category: 'categories',
  Product: 'products',
  Allergen: 'allergens',
  ProductOption: 'product_options',
  FixedMenu: 'fixed_menus',
  ComandaTemplate: 'comanda_templates',
  Festa: 'feste',
  AppSettings: 'app_settings',
  OrderCode: 'order_codes',
  CashierOrder: 'cashier_orders',
  User: 'profiles',
};

function parseSortString(sort) {
  if (!sort) return { field: 'created_date', ascending: false };
  let ascending = true;
  let field = sort;
  if (sort.startsWith('-')) {
    ascending = false;
    field = sort.slice(1);
  }
  return { field, ascending };
}


function createEntityApi(entityName) {
  const table = ENTITY_TO_TABLE[entityName];
  return {
    async list(sort, limit = 1000) {
      if (!table) throw new Error(`Unknown entity: ${entityName}`);
      const { field, ascending } = parseSortString(sort);
      const q = supabase.from(table).select('*').order(field, { ascending });
      if (limit) q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    // Scarica TUTTE le righe della tabella, indipendentemente da quante sono,
    // "a pagine" (di default 1000 alla volta). Da usare per report/esportazioni
    // dove serve avere davvero tutto, senza rischiare di troncare i dati.
    async listAll(sort, batchSize = 1000) {
      if (!table) throw new Error(`Unknown entity: ${entityName}`);
      const { field, ascending } = parseSortString(sort);
      let allRows = [];
      let from = 0;
      while (true) {
        const to = from + batchSize - 1;
        const { data, error } = await supabase.from(table).select('*').order(field, { ascending }).range(from, to);
        if (error) throw error;
        allRows = allRows.concat(data || []);
        if (!data || data.length < batchSize) break;
        from += batchSize;
      }
      return allRows;
    },
    async filter(filters) {
      if (!table) throw new Error(`Unknown entity: ${entityName}`);
      let q = supabase.from(table).select('*');
      for (const [key, value] of Object.entries(filters || {})) {
        q = q.eq(key, value);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    async create(payload) {
      if (!table) throw new Error(`Unknown entity: ${entityName}`);
      const { data, error } = await supabase.from(table).insert([payload]).select('*').maybeSingle();
      if (error) throw error;
      return data;
    },
    async update(id, payload) {
      if (!table) throw new Error(`Unknown entity: ${entityName}`);
      const { data, error } = await supabase.from(table).update(payload).eq('id', id).select('*').maybeSingle();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      if (!table) throw new Error(`Unknown entity: ${entityName}`);
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    async deleteMany(filters) {
      if (!table) throw new Error(`Unknown entity: ${entityName}`);
      let q = supabase.from(table).delete();
      for (const [key, value] of Object.entries(filters || {})) {
        q = q.eq(key, value);
      }
      const { error } = await q;
      if (error) throw error;
      return true;
    },
  };
}

export const entities = {};
for (const entityName of Object.keys(ENTITY_TO_TABLE)) {
  entities[entityName] = createEntityApi(entityName);
}

export const functions = {
  async invoke(name, args) {
    const res = await fetch(`/api/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    });
    if (!res.ok) {
      let errorMsg = `API error ${res.status}`;
      try {
        const err = await res.json();
        errorMsg = err.error || err.message || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }
    const data = await res.json().catch(() => ({}));
    return { data, status: res.status };
  },
};

export const auth = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!user) throw { status: 401, message: 'Not authenticated' };
    let role = 'user';
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role) role = profile.role;
    return {
      id: user.id,
      email: user.email,
      role,
      ...user,
    };
  },
  async logout(redirectTo) {
    await supabase.auth.signOut();
    if (redirectTo) {
      window.location.href = redirectTo;
    }
  },
  redirectToLogin(redirectTo) {
    const params = new URLSearchParams();
    if (redirectTo) params.set('redirectTo', redirectTo);
    window.location.href = `/login${params.toString() ? '?' + params.toString() : ''}`;
  },
  get token() {
    return null;
  },
};

export const asServiceRole = {
  connectors: {
    async getConnection(name) {
      if (name === 'googledrive') {
        return {
          accessToken: import.meta.env.VITE_GOOGLE_DRIVE_ACCESS_TOKEN || '',
        };
      }
      return {};
    },
  },
};

export const base44 = {
  entities,
  functions,
  auth,
  asServiceRole,
  supabase,
};

export default base44;
