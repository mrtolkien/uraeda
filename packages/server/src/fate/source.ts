// fate ships sources for Prisma and Drizzle only: these read data that is not in a database, through
// the binding, with the types fate exports.
import { createSourcePlan, type SourceDefinition, type SourceRegistry } from "@nkzw/fate/server";

type AnyRecord = Record<string, unknown>;

/** A data view of records of `Item`: fate does not export its type by name. */
export type DataView<Item extends AnyRecord> = SourceDefinition<Item>["view"];

/** How a type's records are read: by ids, and as a list for the roots that list them. */
export type FileSourceReaders<Context, Item extends AnyRecord> = {
  byIds: (ctx: Context, ids: Array<string>) => Promise<Array<Item>>;
  list?: (ctx: Context) => Promise<Array<Item>>;
};

type Entry<Context> = {
  definition: SourceDefinition<AnyRecord>;
  readers: FileSourceReaders<Context, AnyRecord>;
};

/** One type's source: its definition, identified by `id`, and its readers. */
export function fileSource<Context, Item extends AnyRecord>(
  view: DataView<Item>,
  readers: FileSourceReaders<Context, Item>,
): Entry<Context> {
  return {
    definition: { id: "id", view } as unknown as SourceDefinition<AnyRecord>,
    readers: readers as unknown as FileSourceReaders<Context, AnyRecord>,
  };
}

/** fate's sources for every type: the definition of each view's type, and their executors. */
export function createSources<Context>(entries: Array<Entry<Context>>) {
  const byType = new Map(entries.map((entry) => [entry.definition.view.typeName, entry]));
  const registry: SourceRegistry<Context> = new Map();
  for (const { definition, readers } of entries) {
    registry.set(definition, {
      byIds: ({ ctx, ids }) => readers.byIds(ctx, ids.map(String)),
      connection: async ({ ctx, cursor, take }) => {
        const items = (await readers.list?.(ctx)) ?? [];
        const start = cursor ? items.findIndex((item) => item.id === cursor) + 1 : 0;
        return cursor && start === 0 ? [] : items.slice(start, start + take);
      },
    });
  }
  const getSource = <Item extends AnyRecord = AnyRecord>(
    target: DataView<Item> | SourceDefinition<Item, unknown>,
  ): SourceDefinition<Item, unknown> => {
    const typeName = "view" in target ? target.view.typeName : target.typeName;
    const entry = byType.get(typeName);
    if (!entry) {
      throw new Error(`No source for ${typeName}`);
    }
    return entry.definition as unknown as SourceDefinition<Item, unknown>;
  };
  /** A record masked to the fields a client selected, as fate's own resolvers return them. */
  const masked = async <Item extends AnyRecord>(
    view: DataView<Item>,
    ctx: Context,
    record: Item,
    select: Iterable<string>,
  ) => createSourcePlan({ ctx, select, source: getSource(view) }).resolve(record);
  return { getSource, registry, masked };
}
