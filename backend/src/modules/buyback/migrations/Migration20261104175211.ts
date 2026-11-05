import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261104175211 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "buyback_order" drop constraint if exists "buyback_order_quote_hash_unique";`);
    this.addSql(`alter table if exists "buyback_order" drop constraint if exists "buyback_order_access_token_unique";`);
    this.addSql(`create table if not exists "buyback_order" ("id" text not null, "display_id" serial, "status" text check ("status" in ('submitted', 'received', 'revised', 'accepted', 'paid', 'declined', 'returned', 'canceled')) not null default 'submitted', "access_token" text not null, "quote_hash" text not null, "device_id" text not null, "device_name" text not null, "brand" text not null, "storage" text not null, "color" text null, "answers" jsonb not null, "inspection" jsonb null, "base_price" integer not null, "quoted_price" integer not null, "quoted_voucher_price" integer not null, "voucher_bonus_percent" real not null default 0, "quote_expires_at" timestamptz not null, "payout_method" text check ("payout_method" in ('bank', 'voucher')) not null, "revised_price" integer null, "revised_voucher_price" integer null, "final_amount" integer null, "first_name" text not null, "last_name" text not null, "email" text not null, "phone" text not null, "delivery_method" text check ("delivery_method" in ('courier', 'store')) not null, "address" jsonb null, "iban" text null, "iban_holder" text null, "customer_note" text null, "admin_note" text null, "customer_message" text null, "awb" text null, "voucher_code" text null, "voucher_promotion_id" text null, "submitted_at" timestamptz not null, "status_changed_at" timestamptz null, "paid_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "buyback_order_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_buyback_order_access_token_unique" ON "buyback_order" ("access_token") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_buyback_order_quote_hash_unique" ON "buyback_order" ("quote_hash") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_buyback_order_deleted_at" ON "buyback_order" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_buyback_order_status" ON "buyback_order" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_buyback_order_email" ON "buyback_order" ("email") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "buyback_order" cascade;`);
  }

}
