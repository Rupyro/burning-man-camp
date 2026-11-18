// Fake, deterministic, idempotent demo kit (docs/specs/procurement.md §7). Writes only
// procurement tables; the one "buy it" task goes through the base task engine (as the seed admin).
import { eq } from "drizzle-orm";
import type { ModuleSeedContext } from "@/base/api";
import { teams } from "@/base/api/schema";
import { campConfig } from "@/lib/camp";
import { campInputToInstant } from "@/lib/dates";
import { newId } from "@/lib/ids";
import type { Category } from "./rules/csv";
import { type Condition, haveIt, type OwnerLabel } from "./rules/have-it";
import type { NeedStatus } from "./rules/status";
import {
  procurementItems,
  procurementLocations,
  procurementNeeds,
  procurementStock,
  procurementStockMovements,
  procurementSuppliers,
} from "./schema";

const PLACES = [
  ["Container A", "container", "Tools and build kit. Padlock code with the infra lead."],
  ["Container B", "container", "Kitchen, shade and camping gear."],
  ["Cape Town storage", "storage", "Fake storage unit (demo)."],
  ["Site: kitchen", "site_area", "On playa, behind the kitchen shade."],
  ["Site: build yard", "site_area", "On playa, next to the art car."],
  ["With Remo (demo)", "person", "Kit someone has at home."],
] as const;

type Stock = [place: number, condition: Condition, qty: number];
type ItemSeed = [
  name: string,
  category: Category,
  unit: string,
  stock: Stock[],
  extra?: { bottleneck?: boolean; owner?: OwnerLabel; asset?: boolean },
];

/** ~30 fake items. Staple guns: 2 in Container A, 1 of them broken (the plan's example). */
const ITEMS: ItemSeed[] = [
  [
    "Staple gun",
    "tool",
    "pcs",
    [
      [0, "good", 1],
      [0, "broken", 1],
    ],
    { bottleneck: true },
  ],
  [
    "Cordless drill",
    "tool",
    "pcs",
    [
      [0, "good", 3],
      [5, "good", 1],
      [0, "needs_repair", 1],
    ],
    { bottleneck: true },
  ],
  ["Impact driver", "tool", "pcs", [[0, "good", 2]], { bottleneck: true }],
  ["Angle grinder", "tool", "pcs", [[0, "good", 1]]],
  [
    "Circular saw",
    "tool",
    "pcs",
    [
      [0, "good", 1],
      [0, "needs_repair", 1],
    ],
    { bottleneck: true },
  ],
  ["Spirit level", "tool", "pcs", [[0, "good", 4]]],
  [
    "Tape measure",
    "tool",
    "pcs",
    [
      [0, "good", 6],
      [0, "missing", 2],
    ],
  ],
  ["Ratchet straps", "tool", "pcs", [[0, "good", 24]]],
  ["Ladder (3 m)", "tool", "pcs", [[2, "good", 2]], { bottleneck: true }],
  ["Generator 5 kVA", "electrical", "pcs", [[2, "good", 1]], { bottleneck: true }],
  [
    "Extension reel (25 m)",
    "electrical",
    "pcs",
    [
      [0, "good", 5],
      [0, "broken", 1],
    ],
  ],
  ["LED strip (5 m)", "sound_lighting", "pcs", [[1, "good", 12]]],
  ["PA speaker", "sound_lighting", "pcs", [[2, "good", 2]], { owner: "shared" }],
  ["Gas burner (3-plate)", "kitchen_equipment", "pcs", [[1, "good", 2]]],
  [
    "Cooler box (100 L)",
    "kitchen_equipment",
    "pcs",
    [
      [1, "good", 4],
      [1, "broken", 1],
    ],
  ],
  ["Stock pot (50 L)", "kitchen_equipment", "pcs", [[1, "good", 3]]],
  ["Chafing dish", "kitchen_equipment", "pcs", [], { owner: "rented" }],
  ["Water drum (210 L)", "plumbing", "pcs", [[2, "good", 6]]],
  ["Shower pump", "plumbing", "pcs", [[2, "needs_repair", 1]]],
  ["Shade cloth (80%)", "building_material", "m", [[1, "good", 60]]],
  ["Scaffold pipe (3 m)", "building_material", "pcs", [[2, "good", 40]], { owner: "khoena" }],
  ["Rebar stakes", "building_material", "pcs", [[0, "good", 80]]],
  ["Cable ties", "consumable", "pcs", [[0, "good", 500]], { asset: false }],
  ["Duct tape", "consumable", "pcs", [[0, "good", 6]], { asset: false }],
  ["Fire extinguisher (4.5 kg)", "safety", "pcs", [[1, "good", 4]]],
  ["First aid kit", "safety", "pcs", [[1, "good", 2]]],
  [
    "Gazebo (3 × 3 m)",
    "camping",
    "pcs",
    [
      [1, "good", 3],
      [1, "broken", 1],
    ],
  ],
  ["Camp chairs", "camping", "pcs", [[1, "good", 20]], { owner: "shared" }],
  ["Fairy lights", "decor", "pcs", [[1, "good", 8]]],
  ["Rice (10 kg bag)", "food", "pcs", [[2, "good", 2]], { asset: false }],
];

const SUPPLIERS = [
  ["Fake Hardware Co (demo)", "hardware", "Pat Demo", "555 0101", "orders@hardware.example.test"],
  ["Fake Gas Depot (demo)", "gas", "Gus Demo", "555 0102", "gas@depot.example.test"],
  ["Fake Party Hire (demo)", "hire", "Hana Demo", "555 0103", "hire@party.example.test"],
  ["Fake Cash & Carry (demo)", "food", "Cas Demo", "555 0104", "sales@cash.example.test"],
] as const;

type NeedSeed = {
  team: string;
  item: string;
  qty: number;
  status: NeedStatus;
  by: "member" | "lead";
  neededBy?: string;
  critical?: boolean;
  supplier?: number;
  estimate?: number;
  notes?: string;
  task?: boolean;
};

/** Needs in every status, incl. a critical generator (feeds Logistics) and one asked-finance. */
const NEEDS: NeedSeed[] = [
  {
    team: "gift_projects",
    item: "Staple gun",
    qty: 4,
    status: "needed",
    by: "member",
    neededBy: "2027-04-01",
    notes: "Cloud build: shade panels.",
  },
  {
    team: "camp_infra",
    item: "Generator 5 kVA",
    qty: 2,
    status: "to_borrow",
    by: "lead",
    neededBy: "2027-04-10",
    critical: true,
    notes: "Second generator for the kitchen fridges.",
  },
  {
    team: "gift_projects",
    item: "Cordless drill",
    qty: 6,
    status: "purchase_requested",
    by: "lead",
    neededBy: "2027-03-20",
    supplier: 0,
    estimate: 3800,
    task: true,
  },
  { team: "kitchen", item: "Gas burner (3-plate)", qty: 2, status: "have_it", by: "member" },
  {
    team: "kitchen",
    item: "Cooler box (100 L)",
    qty: 6,
    status: "to_buy",
    by: "member",
    neededBy: "2027-04-05",
    supplier: 0,
    estimate: 2400,
  },
  {
    team: "kitchen",
    item: "Chafing dish",
    qty: 4,
    status: "to_borrow",
    by: "member",
    supplier: 2,
    notes: "Hire for the gifting dinner.",
  },
  {
    team: "kitchen",
    item: "Rice (10 kg bag)",
    qty: 6,
    status: "ordered",
    by: "member",
    neededBy: "2027-04-15",
    supplier: 3,
    estimate: 1500,
  },
  { team: "camp_infra", item: "Extension reel (25 m)", qty: 8, status: "received", by: "lead" },
  {
    team: "gift_projects",
    item: "Fairy lights",
    qty: 20,
    status: "cancelled",
    by: "member",
    notes: "Using LED strip instead.",
  },
  {
    team: "camp_infra",
    item: "Ladder (3 m)",
    qty: 3,
    status: "needed",
    by: "lead",
    neededBy: "2027-04-12",
  },
];

export async function seed({ db, edition, people, tasks }: ModuleSeedContext) {
  const [done] = await db.select({ id: procurementItems.id }).from(procurementItems).limit(1);
  if (done) return;
  const teamRows = await db
    .select({ id: teams.id, key: teams.key })
    .from(teams)
    .where(eq(teams.editionId, edition.id));
  const teamId = (key: string) => teamRows.find((t) => t.key === key)?.id;

  const places = await db
    .insert(procurementLocations)
    .values(PLACES.map(([name, kind, description]) => ({ name, kind, description })))
    .returning();
  const itemRows = await db
    .insert(procurementItems)
    .values(
      ITEMS.map(([name, category, unit, , x]) => ({
        name,
        category,
        unit,
        isBottleneck: x?.bottleneck ?? false,
        ownerLabel: x?.owner ?? campConfig.owners.campKey,
        isAsset: x?.asset ?? true,
      })),
    )
    .returning();
  const itemId = (name: string) => itemRows.find((i) => i.name === name)?.id ?? "";
  const counted = new Date("2026-05-10T10:00:00Z"); // last year's strike count
  for (const [name, , , stock] of ITEMS) {
    for (const [place, condition, quantity] of stock) {
      const locationId = places[place]?.id ?? "";
      await db.insert(procurementStock).values({
        itemId: itemId(name),
        locationId,
        condition,
        quantity,
        countedAt: counted,
        countedByPersonId: people.admin,
      });
      await db.insert(procurementStockMovements).values({
        itemId: itemId(name),
        toLocationId: locationId,
        condition,
        delta: quantity,
        reason: "count",
        note: "2026 strike count (demo)",
        actorPersonId: people.admin,
        at: counted,
      });
    }
  }
  const supplierRows = await db
    .insert(procurementSuppliers)
    .values(
      SUPPLIERS.map(([name, category, contactName, contactPhone, email]) => ({
        name,
        category,
        contactName,
        contactPhone,
        email,
        lastUsedYear: 2026,
      })),
    )
    .returning();

  for (const n of NEEDS) {
    const team = teamId(n.team);
    if (!team) continue;
    const owner = n.by === "lead" ? people.lead : people.member;
    const id = newId();
    let taskId: string | null = null;
    if (n.task) {
      const project = await tasks.ensureProject({
        teamKey: n.team,
        name: `Kit and buying ${edition.year}`,
        description: "Kit the team has to buy or borrow (Kit and stock module).",
      });
      const item = ITEMS.find(([name]) => name === n.item);
      const lines = (item?.[3] ?? []).map(([, condition, quantity]) => ({
        locationName: "",
        condition,
        quantity,
      }));
      taskId = (
        await tasks.create({
          projectId: project.id,
          title: `Buy ${haveIt(n.qty, lines).gap} pcs ${n.item}`,
          kind: "procurement.buy",
          dueAt: n.neededBy ? campInputToInstant(n.neededBy, "12:00") : null,
          ownerPersonId: owner,
          source: { refType: "procurement.need", refId: id },
        })
      ).id;
    }
    await db.insert(procurementNeeds).values({
      id,
      editionId: edition.id,
      teamId: team,
      itemId: itemId(n.item),
      quantityNeeded: n.qty,
      status: n.status,
      isCritical: n.critical ?? false,
      neededBy: n.neededBy ?? null,
      supplierId: n.supplier === undefined ? null : (supplierRows[n.supplier]?.id ?? null),
      estimateCents: n.estimate ? n.estimate * 100 : null,
      ownerPersonId: owner,
      raisedByPersonId: owner,
      notes: n.notes ?? null,
      taskId,
    });
  }
}
