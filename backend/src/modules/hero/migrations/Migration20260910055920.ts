import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260910055920 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "hero_slide" add column if not exists "video_url_mobile" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "hero_slide" drop column if exists "video_url_mobile";`);
  }

}
