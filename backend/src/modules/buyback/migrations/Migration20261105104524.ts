import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261105104524 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "buyback_order" add column if not exists "cnp" text null, add column if not exists "id_document" text null, add column if not exists "home_address" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "buyback_order" drop column if exists "cnp", drop column if exists "id_document", drop column if exists "home_address";`);
  }

}
