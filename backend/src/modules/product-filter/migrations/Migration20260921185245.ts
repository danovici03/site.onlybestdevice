import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260921185245 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "filter_value" drop constraint if exists "filter_value_attribute_id_slug_unique";`);
    this.addSql(`alter table if exists "filter_attribute_category" drop constraint if exists "filter_attribute_category_attribute_id_category_id_unique";`);
    this.addSql(`alter table if exists "filter_attribute" drop constraint if exists "filter_attribute_key_unique";`);
    this.addSql(`create table if not exists "filter_attribute" ("id" text not null, "key" text not null, "label" text not null, "type" text check ("type" in ('select', 'number')) not null default 'select', "display" text check ("display" in ('chips', 'swatch')) not null default 'chips', "unit" text null, "is_global" boolean not null default false, "is_multi" boolean not null default false, "sources" text[] not null default '{}', "extractor" text null, "rank" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "filter_attribute_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_filter_attribute_deleted_at" ON "filter_attribute" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_filter_attribute_key_unique" ON "filter_attribute" ("key") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "filter_attribute_category" ("id" text not null, "category_id" text not null, "rank" integer not null default 0, "attribute_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "filter_attribute_category_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_filter_attribute_category_attribute_id" ON "filter_attribute_category" ("attribute_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_filter_attribute_category_deleted_at" ON "filter_attribute_category" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_filter_attribute_category_attribute_id_category_id_unique" ON "filter_attribute_category" ("attribute_id", "category_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_filter_attribute_category_category_id" ON "filter_attribute_category" ("category_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "filter_value" ("id" text not null, "value" text not null, "slug" text not null, "hex" text null, "aliases" text[] not null default '{}', "rank" integer not null default 0, "attribute_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "filter_value_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_filter_value_attribute_id" ON "filter_value" ("attribute_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_filter_value_deleted_at" ON "filter_value" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_filter_value_attribute_id_slug_unique" ON "filter_value" ("attribute_id", "slug") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "product_filter_value" ("id" text not null, "product_id" text not null, "value_number" real null, "source" text check ("source" in ('auto', 'manual')) not null default 'auto', "attribute_id" text not null, "value_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_filter_value_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_filter_value_attribute_id" ON "product_filter_value" ("attribute_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_filter_value_value_id" ON "product_filter_value" ("value_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_filter_value_deleted_at" ON "product_filter_value" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_filter_value_product_id" ON "product_filter_value" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_filter_value_attribute_id_value_id" ON "product_filter_value" ("attribute_id", "value_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_filter_value_attribute_id_value_number" ON "product_filter_value" ("attribute_id", "value_number") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "filter_attribute_category" add constraint "filter_attribute_category_attribute_id_foreign" foreign key ("attribute_id") references "filter_attribute" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table if exists "filter_value" add constraint "filter_value_attribute_id_foreign" foreign key ("attribute_id") references "filter_attribute" ("id") on update cascade on delete cascade;`);

    this.addSql(`alter table if exists "product_filter_value" add constraint "product_filter_value_attribute_id_foreign" foreign key ("attribute_id") references "filter_attribute" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table if exists "product_filter_value" add constraint "product_filter_value_value_id_foreign" foreign key ("value_id") references "filter_value" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "filter_attribute_category" drop constraint if exists "filter_attribute_category_attribute_id_foreign";`);

    this.addSql(`alter table if exists "filter_value" drop constraint if exists "filter_value_attribute_id_foreign";`);

    this.addSql(`alter table if exists "product_filter_value" drop constraint if exists "product_filter_value_attribute_id_foreign";`);

    this.addSql(`alter table if exists "product_filter_value" drop constraint if exists "product_filter_value_value_id_foreign";`);

    this.addSql(`drop table if exists "filter_attribute" cascade;`);

    this.addSql(`drop table if exists "filter_attribute_category" cascade;`);

    this.addSql(`drop table if exists "filter_value" cascade;`);

    this.addSql(`drop table if exists "product_filter_value" cascade;`);
  }

}
