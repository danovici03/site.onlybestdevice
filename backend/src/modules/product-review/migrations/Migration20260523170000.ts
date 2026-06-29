import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260523170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "product_review" (
      "id" text not null,
      "product_id" text not null,
      "variant_id" text null,
      "customer_id" text null,
      "customer_name" text not null,
      "customer_email" text null,
      "rating" integer not null,
      "title" text null,
      "body" text not null,
      "status" text check ("status" in ('pending','approved','rejected')) not null default 'pending',
      "is_verified_purchase" boolean not null default false,
      "admin_response" text null,
      "created_at" timestamptz not null default now(),
      "updated_at" timestamptz not null default now(),
      "deleted_at" timestamptz null,
      constraint "product_review_pkey" primary key ("id"),
      constraint "product_review_rating_range" check ("rating" between 1 and 5)
    );`)

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_review_product_id" ON "product_review" ("product_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_review_customer_id" ON "product_review" ("customer_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_review_status" ON "product_review" ("status") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_review_deleted_at" ON "product_review" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_review_one_per_customer" ON "product_review" ("product_id", "customer_id") WHERE deleted_at IS NULL AND customer_id IS NOT NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_review" cascade;`)
  }
}
