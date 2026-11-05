import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261104150743 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "buyback_rule" drop constraint if exists "buyback_rule_key_scope_scope_value_unique";`);
    this.addSql(`alter table if exists "buyback_price" drop constraint if exists "buyback_price_device_id_storage_unique";`);
    this.addSql(`alter table if exists "buyback_device" drop constraint if exists "buyback_device_handle_unique";`);
    this.addSql(`create table if not exists "buyback_device" ("id" text not null, "brand" text not null, "model" text not null, "handle" text not null, "phone_group" text null, "image_url" text null, "colors" jsonb null, "is_active" boolean not null default true, "rank" integer not null default 0, "competitor_price" integer null, "competitor_ref" text null, "competitor_checked_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "buyback_device_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_buyback_device_handle_unique" ON "buyback_device" ("handle") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_buyback_device_deleted_at" ON "buyback_device" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_buyback_device_brand" ON "buyback_device" ("brand") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "buyback_price" ("id" text not null, "storage" text not null, "base_price" integer null, "device_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "buyback_price_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_buyback_price_device_id" ON "buyback_price" ("device_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_buyback_price_deleted_at" ON "buyback_price" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_buyback_price_device_id_storage_unique" ON "buyback_price" ("device_id", "storage") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "buyback_rule" ("id" text not null, "key" text not null, "scope" text check ("scope" in ('global', 'brand', 'device')) not null default 'global', "scope_value" text not null default '', "kind" text check ("kind" in ('fixed', 'percent', 'reject')) not null, "value" real not null default 0, "note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "buyback_rule_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_buyback_rule_deleted_at" ON "buyback_rule" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_buyback_rule_key_scope_scope_value_unique" ON "buyback_rule" ("key", "scope", "scope_value") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "buyback_price" add constraint "buyback_price_device_id_foreign" foreign key ("device_id") references "buyback_device" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "buyback_price" drop constraint if exists "buyback_price_device_id_foreign";`);

    this.addSql(`drop table if exists "buyback_device" cascade;`);

    this.addSql(`drop table if exists "buyback_price" cascade;`);

    this.addSql(`drop table if exists "buyback_rule" cascade;`);
  }

}
