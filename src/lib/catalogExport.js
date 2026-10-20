// Esportazione / importazione del catalogo di una festa in formato JSON:
// reparti, prodotti (con prezzi), menu fissi, e gli allergeni / opzioni usati.
// Il file è indipendente dal database: i riferimenti tra prodotti, reparti e
// menu usano gli id originali solo come "ref" interni al file, mentre allergeni
// e opzioni sono riconosciuti per nome.

import { base44, supabase } from '@/api/base44Client';

export const CATALOG_FORMAT = 'cassa-feste-catalog';
export const CATALOG_VERSION = 1;

const SYSTEM_KEYS = ['id', 'created_date', 'updated_date', 'festa_id'];

function strip(row, extraKeys = []) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (SYSTEM_KEYS.includes(k) || extraKeys.includes(k)) continue;
    out[k] = v;
  }
  return out;
}

const nameKey = (s) => String(s || '').trim().toLowerCase();

export function buildCatalogExport({ festa, categories, products, allergens, productOptions, fixedMenus }) {
  const allergenById = new Map(allergens.map(a => [a.id, a]));
  const optionById = new Map(productOptions.map(o => [o.id, o]));
  const usedAllergens = new Set();
  const usedOptions = new Set();

  const cats = [...categories]
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map(c => ({
      ref: c.id,
      ...strip(c),
      products: products
        .filter(p => p.category_id === c.id)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(p => {
          const allergenNames = (p.allergens || []).map(id => allergenById.get(id)).filter(Boolean);
          const optionNames = (p.option_ids || []).map(id => optionById.get(id)).filter(Boolean);
          allergenNames.forEach(a => usedAllergens.add(a.id));
          optionNames.forEach(o => usedOptions.add(o.id));
          return {
            ref: p.id,
            ...strip(p, ['category_id', 'allergens', 'option_ids']),
            allergens: allergenNames.map(a => a.name_it),
            options: optionNames.map(o => o.name_it),
          };
        }),
    }));

  return {
    format: CATALOG_FORMAT,
    version: CATALOG_VERSION,
    exported_at: new Date().toISOString(),
    festa: { name: festa?.name || '', theme_color: festa?.theme_color || null },
    allergens: allergens.filter(a => usedAllergens.has(a.id)).map(a => strip(a)),
    product_options: productOptions.filter(o => usedOptions.has(o.id)).map(o => strip(o)),
    categories: cats,
    // i menu fissi puntano ai prodotti tramite il loro "ref"
    fixed_menus: fixedMenus.map(m => strip(m)),
  };
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function catalogFilename(festa) {
  const slug = String(festa?.name || 'festa')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'festa';
  return `catalogo-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
}

// Legge e valida il testo di un file JSON. Lancia Error con messaggio chiaro.
export function parseCatalogFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Il file non è un JSON valido.');
  }
  if (!data || data.format !== CATALOG_FORMAT) {
    throw new Error('Questo file non è un catalogo esportato da questa app.');
  }
  if (data.version > CATALOG_VERSION) {
    throw new Error('Il file è stato creato da una versione più recente dell\'app.');
  }
  if (!Array.isArray(data.categories)) {
    throw new Error('Il file non contiene reparti.');
  }
  for (const c of data.categories) {
    if (!c.name_it || !Array.isArray(c.products || [])) throw new Error('Reparto non valido nel file.');
    for (const p of c.products || []) {
      if (!p.name_it || typeof p.price !== 'number') throw new Error(`Prodotto non valido nel reparto "${c.name_it}".`);
    }
  }
  return data;
}

export function summarizeCatalog(data) {
  return {
    festaName: data.festa?.name || '',
    categories: data.categories.length,
    products: data.categories.reduce((n, c) => n + (c.products || []).length, 0),
    menus: (data.fixed_menus || []).length,
  };
}

async function insertMany(table, rows) {
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + 100));
    if (error) throw error;
  }
}

// mode: 'merge'   -> unisce al catalogo esistente (stesso nome = aggiorna, nuovo = crea)
//       'replace' -> cancella il catalogo della festa e ricrea tutto dal file
export async function importCatalog(data, { festaId, mode, current }) {
  const { categories: curCats, products: curProds, fixedMenus: curMenus, allergens, productOptions } = current;
  const newId = () => crypto.randomUUID();

  if (mode === 'replace') {
    await base44.entities.FixedMenu.deleteMany({ festa_id: festaId });
    await base44.entities.Product.deleteMany({ festa_id: festaId });
    await base44.entities.Category.deleteMany({ festa_id: festaId });
  }
  const existingCats = mode === 'replace' ? [] : curCats;
  const existingProds = mode === 'replace' ? [] : curProds;
  const existingMenus = mode === 'replace' ? [] : curMenus;

  // 1) allergeni e opzioni: riconosciuti per nome, creati se mancano
  const allergenIdByName = new Map(allergens.map(a => [nameKey(a.name_it), a.id]));
  const newAllergens = [];
  for (const a of data.allergens || []) {
    if (!a.name_it || allergenIdByName.has(nameKey(a.name_it))) continue;
    const id = newId();
    allergenIdByName.set(nameKey(a.name_it), id);
    newAllergens.push({ ...strip(a), id });
  }
  const optionIdByName = new Map(productOptions.map(o => [nameKey(o.name_it), o.id]));
  const newOptions = [];
  for (const o of data.product_options || []) {
    if (!o.name_it || optionIdByName.has(nameKey(o.name_it))) continue;
    const id = newId();
    optionIdByName.set(nameKey(o.name_it), id);
    newOptions.push({ ...strip(o), id });
  }
  await insertMany('allergens', newAllergens);
  await insertMany('product_options', newOptions);

  // 2) reparti e prodotti
  const productIdByRef = new Map();
  const catRows = [];
  const catUpdates = [];
  const prodRows = [];
  const prodUpdates = [];
  let maxCatOrder = existingCats.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);

  for (const c of data.categories) {
    const { products: prods = [], ref: catRef, ...catFields } = c;
    const found = existingCats.find(x => nameKey(x.name_it) === nameKey(c.name_it));
    let catId;
    if (found) {
      catId = found.id;
      const { sort_order, ...withoutOrder } = strip(catFields);
      catUpdates.push({ id: catId, payload: withoutOrder });
    } else {
      catId = newId();
      maxCatOrder += 10;
      catRows.push({ ...strip(catFields), sort_order: mode === 'replace' ? (c.sort_order ?? maxCatOrder) : maxCatOrder, id: catId, festa_id: festaId });
    }

    let maxProdOrder = existingProds
      .filter(p => p.category_id === catId)
      .reduce((m, p) => Math.max(m, p.sort_order || 0), 0);

    for (const p of prods) {
      const { ref: prodRef, allergens: pAllergens = [], options: pOptions = [], ...fields } = p;
      const payload = {
        ...strip(fields),
        allergens: pAllergens.map(n => allergenIdByName.get(nameKey(n))).filter(Boolean),
        option_ids: pOptions.map(n => optionIdByName.get(nameKey(n))).filter(Boolean),
      };
      const foundProd = existingProds.find(x => x.category_id === catId && nameKey(x.name_it) === nameKey(p.name_it));
      if (foundProd) {
        productIdByRef.set(prodRef, foundProd.id);
        const { sort_order, ...withoutOrder } = payload;
        prodUpdates.push({ id: foundProd.id, payload: withoutOrder });
      } else {
        const id = newId();
        productIdByRef.set(prodRef, id);
        maxProdOrder += 10;
        prodRows.push({ ...payload, sort_order: mode === 'replace' ? (p.sort_order ?? maxProdOrder) : maxProdOrder, id, category_id: catId, festa_id: festaId });
      }
    }
  }

  await insertMany('categories', catRows);
  await insertMany('products', prodRows);
  for (const u of catUpdates) await base44.entities.Category.update(u.id, u.payload);
  for (const u of prodUpdates) await base44.entities.Product.update(u.id, u.payload);

  // 3) menu fissi (i prodotti sono rimappati dal "ref" al nuovo id)
  const mapIds = (ids) => (ids || []).map(r => productIdByRef.get(r)).filter(Boolean);
  const menuRows = [];
  const menuUpdates = [];
  for (const m of data.fixed_menus || []) {
    const payload = {
      ...strip(m, ['first_course_ids', 'second_course_ids', 'extra_drink_ids']),
      first_course_ids: mapIds(m.first_course_ids),
      second_course_ids: mapIds(m.second_course_ids),
      extra_drink_ids: mapIds(m.extra_drink_ids),
    };
    const foundMenu = existingMenus.find(x => nameKey(x.name_it) === nameKey(m.name_it));
    if (foundMenu) menuUpdates.push({ id: foundMenu.id, payload });
    else menuRows.push({ ...payload, id: newId(), festa_id: festaId });
  }
  await insertMany('fixed_menus', menuRows);
  for (const u of menuUpdates) await base44.entities.FixedMenu.update(u.id, u.payload);

  return {
    categories: catRows.length + catUpdates.length,
    products: prodRows.length + prodUpdates.length,
    productsCreated: prodRows.length,
    productsUpdated: prodUpdates.length,
    menus: menuRows.length + menuUpdates.length,
  };
}
