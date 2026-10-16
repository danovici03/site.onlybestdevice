import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260921190151 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "filter_attribute" add column if not exists "closed_values" boolean not null default false;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "filter_attribute" drop column if exists "closed_values";`);
  }

}
