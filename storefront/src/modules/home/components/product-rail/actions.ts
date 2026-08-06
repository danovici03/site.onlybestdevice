"use server"

import { fetchRailPage } from "@lib/data/rails"
import type { RailPage, RailSource } from "@lib/util/rail"

/**
 * Pagina următoare a unui rail, cerută din browser când drag-ul se apropie de
 * capătul listei.
 *
 * E o acțiune de server, nu un fetch către backend: cheia publicabilă și
 * regiunea rămân pe server, iar răspunsul trece prin exact aceleași funcții de
 * catalog (și același cache) ca randarea inițială.
 */
export const loadRailPage = async (
  source: RailSource,
  page: number,
  limit?: number
): Promise<RailPage> => fetchRailPage(source, page, limit)
