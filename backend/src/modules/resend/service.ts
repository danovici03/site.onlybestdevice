import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/types"
import { Resend } from "resend"
import { renderTemplate } from "./templates"

type Options = {
  api_key: string
  from: string
  reply_to?: string
}

type InjectedDependencies = {
  logger: Logger
}

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "resend"

  protected logger_: Logger
  protected options_: Options
  protected client_: Resend

  constructor({ logger }: InjectedDependencies, options: Options) {
    super()
    this.logger_ = logger
    this.options_ = options
    this.client_ = new Resend(options.api_key)
  }

  static validateOptions(options: Record<string, unknown>): void {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Resend notification provider requires `api_key`.",
      )
    }
    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Resend notification provider requires `from`.",
      )
    }
  }

  async send(
    notification: ProviderSendNotificationDTO,
  ): Promise<ProviderSendNotificationResultsDTO> {
    if (!notification.to) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Notification requires a `to` address.",
      )
    }

    const rendered = renderTemplate(
      notification.template,
      (notification.data as Record<string, any>) ?? {},
    )

    const subject = rendered?.subject ?? notification.content?.subject
    const html = rendered?.html ?? notification.content?.html
    const text = rendered?.text ?? notification.content?.text

    if (!subject || (!html && !text)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Resend: missing template "${notification.template}" and no inline content provided.`,
      )
    }

    const providerData = (notification.provider_data ?? {}) as Record<string, any>

    const payload: Record<string, any> = {
      from: notification.from || this.options_.from,
      to: notification.to,
      subject,
      replyTo: providerData.reply_to ?? this.options_.reply_to,
      cc: providerData.cc,
      bcc: providerData.bcc,
      attachments: notification.attachments?.map((a) => ({
        filename: a.filename ?? "attachment",
        content: a.content,
        contentType: a.content_type,
      })),
    }
    if (html) payload.html = html
    if (text) payload.text = text

    try {
      const { data, error } = await this.client_.emails.send(payload as any)

      if (error) {
        this.logger_.error(
          `Resend send failed (${notification.template} → ${notification.to}): ${error.message}`,
        )
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
      }

      this.logger_.info(
        `Resend sent ${notification.template} → ${notification.to} (id: ${data?.id})`,
      )
      return { id: data?.id }
    } catch (e) {
      const msg = (e as Error).message
      this.logger_.error(`Resend exception (${notification.template}): ${msg}`)
      throw e
    }
  }
}

export default ResendNotificationProviderService
