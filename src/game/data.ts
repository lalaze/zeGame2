export type Category = 'coffee' | 'tea' | 'bread' | 'pastry';

/** Categories in menu order. Drinks pair with bakery items in combo orders. */
export const CATEGORIES: readonly Category[] = ['coffee', 'tea', 'bread', 'pastry'];
export const isDrink = (c: Category) => c === 'coffee' || c === 'tea';

export type StaticItemId =
  // coffee
  | 'espresso'
  | 'americano'
  | 'latte'
  | 'cappuccino'
  | 'flatwhite'
  | 'cortado'
  | 'mocha'
  | 'vienna'
  | 'macchiato'
  | 'coldbrew'
  | 'dirty'
  | 'pourover'
  | 'creamcoffee'
  | 'affogato'
  // tea and other drinks
  | 'blacktea'
  | 'hotchoc'
  | 'lemontea'
  | 'chai'
  | 'fruittea'
  | 'hojicha'
  | 'matcha'
  | 'frappe'
  | 'smoothie'
  | 'milktea'
  | 'matchafloat'
  // bread
  | 'roll'
  | 'bagel'
  | 'baguette'
  | 'cheesebun'
  | 'pretzel'
  | 'focaccia'
  | 'ciabatta'
  | 'raisinbread'
  | 'sourdough'
  | 'rye'
  | 'chocobread'
  | 'shokupan'
  | 'brioche'
  | 'fruitbrioche'
  | 'garlicbread'
  // pastries and cakes
  | 'donut'
  | 'scone'
  | 'cookie'
  | 'croissant'
  | 'painchoc'
  | 'brownie'
  | 'cinnamon'
  | 'muffin'
  | 'creampuff'
  | 'melonpan'
  | 'eggtart'
  | 'cake'
  | 'swissroll'
  | 'cheesecake'
  | 'macaron';

export type ItemId = StaticItemId | `sig:${string}`;

export interface MenuItemDef {
  id: ItemId;
  category: Category;
  /** Price per sale at level 1, before milestones and tips. */
  basePrice: number;
  /** Seconds a barista needs to make it (or plate it, for bakery items), before machine upgrades. */
  prepTime: number;
  /** Cost to unlock (level 0 -> 1). Later levels grow by ITEM_COST_GROWTH. */
  baseCost: number;
}

// Each category unlocks in the order listed. New recipes fill gaps across the
// progression, with different ingredient costs and serving times at each tier.
export const MENU: readonly (MenuItemDef & { id: StaticItemId })[] = [
  { id: 'espresso', category: 'coffee', basePrice: 3, prepTime: 1.2, baseCost: 8 },
  { id: 'americano', category: 'coffee', basePrice: 5, prepTime: 2.4, baseCost: 40 },
  { id: 'latte', category: 'coffee', basePrice: 10, prepTime: 5, baseCost: 120 },
  { id: 'cappuccino', category: 'coffee', basePrice: 35, prepTime: 3.5, baseCost: 1_200 },
  { id: 'flatwhite', category: 'coffee', basePrice: 60, prepTime: 3.2, baseCost: 4_000 },
  { id: 'cortado', category: 'coffee', basePrice: 150, prepTime: 2.6, baseCost: 16_000 },
  { id: 'mocha', category: 'coffee', basePrice: 400, prepTime: 4, baseCost: 70_000 },
  { id: 'vienna', category: 'coffee', basePrice: 750, prepTime: 4.8, baseCost: 180_000 },
  { id: 'macchiato', category: 'coffee', basePrice: 1_300, prepTime: 4.2, baseCost: 450_000 },
  { id: 'coldbrew', category: 'coffee', basePrice: 4_500, prepTime: 2.5, baseCost: 3_500_000 },
  { id: 'dirty', category: 'coffee', basePrice: 16_000, prepTime: 2.2, baseCost: 32_000_000 },
  { id: 'pourover', category: 'coffee', basePrice: 70_000, prepTime: 6, baseCost: 350_000_000 },
  { id: 'creamcoffee', category: 'coffee', basePrice: 130_000, prepTime: 5, baseCost: 950_000_000 },
  { id: 'affogato', category: 'coffee', basePrice: 240_000, prepTime: 3.5, baseCost: 2_800_000_000 },

  { id: 'blacktea', category: 'tea', basePrice: 9, prepTime: 4, baseCost: 90 },
  { id: 'hotchoc', category: 'tea', basePrice: 30, prepTime: 3, baseCost: 900 },
  { id: 'lemontea', category: 'tea', basePrice: 55, prepTime: 2.5, baseCost: 2_800 },
  { id: 'chai', category: 'tea', basePrice: 100, prepTime: 3.5, baseCost: 8_000 },
  { id: 'fruittea', category: 'tea', basePrice: 350, prepTime: 3.8, baseCost: 50_000 },
  { id: 'hojicha', category: 'tea', basePrice: 750, prepTime: 3.2, baseCost: 180_000 },
  { id: 'matcha', category: 'tea', basePrice: 1_400, prepTime: 4.5, baseCost: 550_000 },
  { id: 'frappe', category: 'tea', basePrice: 5_000, prepTime: 5, baseCost: 4_500_000 },
  { id: 'smoothie', category: 'tea', basePrice: 16_000, prepTime: 4, baseCost: 35_000_000 },
  { id: 'milktea', category: 'tea', basePrice: 65_000, prepTime: 4.5, baseCost: 300_000_000 },
  { id: 'matchafloat', category: 'tea', basePrice: 230_000, prepTime: 5.5, baseCost: 2_500_000_000 },

  { id: 'roll', category: 'bread', basePrice: 8, prepTime: 0.8, baseCost: 30 },
  { id: 'bagel', category: 'bread', basePrice: 12, prepTime: 2.8, baseCost: 150 },
  { id: 'baguette', category: 'bread', basePrice: 30, prepTime: 1.2, baseCost: 1_000 },
  { id: 'cheesebun', category: 'bread', basePrice: 55, prepTime: 1.8, baseCost: 3_200 },
  { id: 'pretzel', category: 'bread', basePrice: 100, prepTime: 1.2, baseCost: 7_000 },
  { id: 'focaccia', category: 'bread', basePrice: 200, prepTime: 1.5, baseCost: 25_000 },
  { id: 'ciabatta', category: 'bread', basePrice: 380, prepTime: 1.5, baseCost: 60_000 },
  { id: 'raisinbread', category: 'bread', basePrice: 750, prepTime: 1.2, baseCost: 180_000 },
  { id: 'sourdough', category: 'bread', basePrice: 1_300, prepTime: 1.5, baseCost: 500_000 },
  { id: 'rye', category: 'bread', basePrice: 4_800, prepTime: 1.5, baseCost: 4_000_000 },
  { id: 'chocobread', category: 'bread', basePrice: 9_000, prepTime: 2, baseCost: 12_000_000 },
  { id: 'shokupan', category: 'bread', basePrice: 17_000, prepTime: 1.5, baseCost: 38_000_000 },
  { id: 'brioche', category: 'bread', basePrice: 66_000, prepTime: 1.5, baseCost: 320_000_000 },
  { id: 'fruitbrioche', category: 'bread', basePrice: 125_000, prepTime: 2.2, baseCost: 900_000_000 },
  { id: 'garlicbread', category: 'bread', basePrice: 230_000, prepTime: 2.5, baseCost: 2_600_000_000 },

  { id: 'donut', category: 'pastry', basePrice: 20, prepTime: 4.5, baseCost: 300 },
  { id: 'scone', category: 'pastry', basePrice: 32, prepTime: 1.2, baseCost: 1_100 },
  { id: 'cookie', category: 'pastry', basePrice: 60, prepTime: 0.8, baseCost: 3_500 },
  { id: 'croissant', category: 'pastry', basePrice: 110, prepTime: 1.5, baseCost: 9_000 },
  { id: 'painchoc', category: 'pastry', basePrice: 180, prepTime: 1.5, baseCost: 20_000 },
  { id: 'brownie', category: 'pastry', basePrice: 260, prepTime: 1.2, baseCost: 38_000 },
  { id: 'cinnamon', category: 'pastry', basePrice: 420, prepTime: 1.5, baseCost: 75_000 },
  { id: 'muffin', category: 'pastry', basePrice: 750, prepTime: 1.2, baseCost: 200_000 },
  { id: 'creampuff', category: 'pastry', basePrice: 1_050, prepTime: 2.5, baseCost: 330_000 },
  { id: 'melonpan', category: 'pastry', basePrice: 1_500, prepTime: 1.2, baseCost: 600_000 },
  { id: 'eggtart', category: 'pastry', basePrice: 5_200, prepTime: 1.5, baseCost: 5_000_000 },
  { id: 'cake', category: 'pastry', basePrice: 18_000, prepTime: 2, baseCost: 40_000_000 },
  { id: 'swissroll', category: 'pastry', basePrice: 36_000, prepTime: 2.5, baseCost: 120_000_000 },
  { id: 'cheesecake', category: 'pastry', basePrice: 72_000, prepTime: 2, baseCost: 380_000_000 },
  { id: 'macaron', category: 'pastry', basePrice: 260_000, prepTime: 1.5, baseCost: 3_200_000_000 },
];

export type UpgradeId = 'barista' | 'server' | 'cook' | 'machine' | 'marketing' | 'tables';

export interface UpgradeDef {
  id: UpgradeId;
  baseCost: number;
  growth: number;
  max: number;
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'marketing', baseCost: 40, growth: 1.75, max: 25 },
  { id: 'machine', baseCost: 60, growth: 1.9, max: 20 },
  { id: 'barista', baseCost: 150, growth: 12, max: 3 },
  { id: 'server', baseCost: 250, growth: 10, max: 2 },
  // Needs the kitchen, which comes with its first cook.
  { id: 'cook', baseCost: 900, growth: 10, max: 2 },
  { id: 'tables', baseCost: 300, growth: 8, max: 6 },
];

export const ITEM_COST_GROWTH = 1.12;
/** Every item level listed here doubles that item's price. */
export const PRICE_MILESTONES = [10, 25, 50, 100, 150, 200, 300] as const;

export const MAX_QUEUE = 6;
export const BASE_ARRIVAL_RATE = 0.2; // customers per second
export const VIP_CHANCE = 0.03;
export const VIP_MULTIPLIER = 5;
/** How many finished orders fit on the pass at the end of the counter: two shelves of three. */
export const PASS_SLOTS = 6;
/** Seconds before a barista rings again for an order nobody has picked up. */
export const RING_AGAIN = 6;
/** Average seconds a service spot is busy on walking, beyond brewing. */
export const SERVICE_OVERHEAD = 1.2;

// ---------------------------------------------------------------- ingredients

export type IngredientId =
  | 'beans'
  | 'milk'
  | 'flour'
  | 'butter'
  | 'eggs'
  | 'sugar'
  | 'tea'
  | 'spice'
  | 'cocoa'
  | 'cream'
  | 'fruit'
  | 'matcha';

export interface IngredientDef {
  id: IngredientId;
  /** Price per unit in the pantry shop. */
  cost: number;
}

export const INGREDIENTS: readonly IngredientDef[] = [
  { id: 'beans', cost: 1 },
  { id: 'milk', cost: 2 },
  { id: 'flour', cost: 1 },
  { id: 'butter', cost: 3 },
  { id: 'eggs', cost: 3 },
  { id: 'sugar', cost: 1 },
  { id: 'tea', cost: 2 },
  { id: 'spice', cost: 6 },
  { id: 'cocoa', cost: 10 },
  { id: 'cream', cost: 12 },
  { id: 'fruit', cost: 20 },
  { id: 'matcha', cost: 40 },
];

/** Units of each ingredient one serving uses. */
export const RECIPES: Record<StaticItemId, Partial<Record<IngredientId, number>>> = {
  espresso: { beans: 1 },
  americano: { beans: 1 },
  latte: { beans: 1, milk: 1 },
  cappuccino: { beans: 1, milk: 1 },
  flatwhite: { beans: 2, milk: 1 },
  cortado: { beans: 1, milk: 1 },
  mocha: { beans: 1, milk: 1, cocoa: 1 },
  vienna: { beans: 1, cream: 2, cocoa: 1 },
  macchiato: { beans: 1, milk: 1, sugar: 1, cream: 1 },
  coldbrew: { beans: 2, sugar: 1 },
  dirty: { beans: 2, milk: 2 },
  pourover: { beans: 2 },
  creamcoffee: { beans: 2, cream: 2, sugar: 1 },
  affogato: { beans: 1, cream: 1, sugar: 1 },

  blacktea: { tea: 1 },
  hotchoc: { cocoa: 1, milk: 1, sugar: 1 },
  lemontea: { tea: 1, fruit: 1, sugar: 1 },
  chai: { tea: 1, milk: 1, spice: 1 },
  fruittea: { tea: 1, fruit: 2, sugar: 1 },
  hojicha: { tea: 2, milk: 1 },
  matcha: { matcha: 1, milk: 1 },
  frappe: { beans: 1, milk: 2, sugar: 1, cream: 1 },
  smoothie: { fruit: 1, milk: 1, sugar: 1 },
  milktea: { tea: 1, milk: 1, cream: 1 },
  matchafloat: { matcha: 2, milk: 1, cream: 2, sugar: 1 },

  roll: { flour: 1, butter: 1 },
  bagel: { flour: 1, sugar: 1 },
  baguette: { flour: 2 },
  cheesebun: { flour: 1, butter: 1, cream: 1 },
  pretzel: { flour: 1, butter: 1, spice: 1 },
  focaccia: { flour: 1, spice: 1 },
  ciabatta: { flour: 2 },
  raisinbread: { flour: 2, fruit: 1, sugar: 1 },
  sourdough: { flour: 2 },
  rye: { flour: 2, spice: 1 },
  chocobread: { flour: 1, milk: 1, butter: 1, cocoa: 1 },
  shokupan: { flour: 1, milk: 1, butter: 1, sugar: 1 },
  brioche: { flour: 1, butter: 1, eggs: 1, sugar: 1 },
  fruitbrioche: { flour: 1, butter: 2, eggs: 1, fruit: 2, sugar: 1 },
  garlicbread: { flour: 1, butter: 1, cream: 1, spice: 1 },

  donut: { flour: 1, sugar: 1, eggs: 1 },
  scone: { flour: 1, butter: 1, cream: 1 },
  cookie: { flour: 1, butter: 1, sugar: 1, cocoa: 1 },
  croissant: { flour: 1, butter: 2 },
  painchoc: { flour: 1, butter: 1, cocoa: 1 },
  brownie: { flour: 1, butter: 1, eggs: 1, sugar: 1, cocoa: 2 },
  cinnamon: { flour: 1, butter: 1, sugar: 1, spice: 1 },
  muffin: { flour: 1, eggs: 1, sugar: 1, fruit: 1 },
  creampuff: { flour: 1, butter: 1, eggs: 2, cream: 2 },
  melonpan: { flour: 1, butter: 1, eggs: 1, sugar: 1 },
  eggtart: { flour: 1, eggs: 2, cream: 1, sugar: 1 },
  cake: { flour: 1, eggs: 1, cream: 1, fruit: 1 },
  swissroll: { flour: 1, eggs: 2, cream: 2, fruit: 1, sugar: 1 },
  cheesecake: { cream: 2, eggs: 1, sugar: 1, flour: 1 },
  macaron: { eggs: 1, sugar: 2, fruit: 1 },
};

/** Morning-bake amounts change in steps of this many. */
export const BAKE_STEP = 5;
/** How many of a bread or pastry a cook bakes at a time. */
export const COOK_BATCH = BAKE_STEP;

/** Chance a customer adds a bakery item to a drink order, or a drink to a bakery order. */
export const COMBO_CHANCE = 0.35;
/** Each dish on the menu beyond the first draws this many more customers (as a share). */
export const VARIETY_BONUS = 0.04;
export const MAX_VARIETY_BONUS = 0.6;

// ---------------------------------------------------------------- the business day

/**
 * The shop stays open until the player closes it. Forecasts (the suggested morning
 * bake, stocking up for a day) plan for a typical day of this many seconds at 1×.
 */
export const DAY_SECONDS = 180;
export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];
