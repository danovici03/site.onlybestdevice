import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260921195741 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "filter_attribute" add column if not exists "excluded_values" text[] not null default '{}';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "filter_attribute" drop column if exists "excluded_values";`);
  }

}
