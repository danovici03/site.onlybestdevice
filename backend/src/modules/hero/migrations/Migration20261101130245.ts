import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261101130245 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "hero_slide" add column if not exists "image_url_mobile" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "hero_slide" drop column if exists "image_url_mobile";`);
  }

}
