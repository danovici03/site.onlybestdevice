import { Module } from "@medusajs/framework/utils"
import HeroModuleService from "./service"

export const HERO_MODULE = "hero"

export default Module(HERO_MODULE, {
  service: HeroModuleService,
})
