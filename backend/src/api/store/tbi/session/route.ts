import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { submitTbiApplication } from '../../../../lib/tbi/submit-application'

type SessionBody = {
  order_id: string
}

/**
 * Întoarce `session_url` — URL-ul TBI unde storefront-ul redirecționează
 * clientul după plasarea unei comenzi „Rate prin TBI Bank".
 *
 * Cererea de credit o trimite subscriber-ul `order.placed`; ruta asta ajunge
 * de obicei în paralel cu el. Amândoi trec prin `submitTbiApplication`, sub
 * același lacăt: primul creează cererea, al doilea primește linkul salvat.
 * Statusul final vine criptat pe /hooks/tbi.
 */
export const POST = async (
  req: MedusaRequest<SessionBody>,
  res: MedusaResponse
) => {
  const orderId = (req.body as SessionBody)?.order_id
  if (!orderId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'order_id lipsește')
  }

  const result = await submitTbiApplication(req.scope, orderId, {
    source: 'storefront',
  })

  if (result.status === 'submitted') {
    return res.json({ session_url: result.redirect_url })
  }
  if (result.status === 'skipped') {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, result.reason)
  }
  // Eșec sau rezultat incert: e deja consemnat pe comandă și anunțat pe
  // email; storefront-ul trimite clientul pe pagina de confirmare.
  throw new MedusaError(
    MedusaError.Types.UNEXPECTED_STATE,
    'Cererea de finanțare TBI nu a putut fi creată'
  )
}
