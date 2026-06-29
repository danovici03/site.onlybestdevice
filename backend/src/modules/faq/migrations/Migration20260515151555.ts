import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260515151555 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "faq_category" drop constraint if exists "faq_category_slug_unique";`);
    this.addSql(`create table if not exists "faq_category" ("id" text not null, "slug" text not null, "title" text not null, "description" text null, "display_order" integer not null default 0, "is_published" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "faq_category_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_faq_category_deleted_at" ON "faq_category" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_faq_category_slug_unique" ON "faq_category" ("slug") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "faq_item" ("id" text not null, "question" text not null, "answer" text not null, "display_order" integer not null default 0, "is_published" boolean not null default true, "category_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "faq_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_faq_item_category_id" ON "faq_item" ("category_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_faq_item_deleted_at" ON "faq_item" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "faq_item" add constraint "faq_item_category_id_foreign" foreign key ("category_id") references "faq_category" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "faq_item" drop constraint if exists "faq_item_category_id_foreign";`);

    this.addSql(`drop table if exists "faq_category" cascade;`);

    this.addSql(`drop table if exists "faq_item" cascade;`);
  }

}
