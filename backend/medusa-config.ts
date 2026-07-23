import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const redisUrl = process.env.REDIS_URL

// S3-compatible object storage (Hetzner, R2, AWS, etc.) is used when
// S3_BUCKET is set. Local dev falls back to writing under ./static.
const s3Bucket = process.env.S3_BUCKET

const fileProvider = s3Bucket
  ? {
      resolve: '@medusajs/medusa/file-s3',
      id: 's3',
      is_default: true,
      options: {
        file_url: process.env.S3_FILE_URL,
        access_key_id: process.env.S3_ACCESS_KEY_ID,
        secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
        region: process.env.S3_REGION,
        bucket: s3Bucket,
        endpoint: process.env.S3_ENDPOINT,
        additional_client_config: {
          forcePathStyle: true,
        },
      },
    }
  : {
      resolve: '@medusajs/medusa/file-local',
      id: 'local',
      is_default: true,
      options: {
        backend_url: `${(process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000').replace(/\/$/, '')}/static`,
        upload_dir: 'static',
      },
    }

const modules: any[] = [
  {
    resolve: '@medusajs/medusa/file',
    options: {
      providers: [fileProvider],
    },
  },
  {
    resolve: './src/modules/faq',
  },
  {
    resolve: './src/modules/product-review',
  },
  {
    resolve: './src/modules/hero',
  },
]

const paymentProviders: any[] = [
  // Plată la livrare (ramburs) — manual, mereu activ. pp_system_default
  // rămâne pentru ordin de plată / transfer bancar.
  {
    resolve: './src/modules/manual-payments',
    id: 'cod',
  },
]

if (process.env.STRIPE_API_KEY) {
  paymentProviders.push({
    resolve: '@medusajs/payment-stripe',
    id: 'stripe',
    options: {
      apiKey: process.env.STRIPE_API_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      capture: true,
      automaticPaymentMethods: true,
    },
  })
}

// Card prin Netopia mobilPay. Se activează când semnătura + cheile există.
if (
  process.env.NETOPIA_POS_SIGNATURE &&
  process.env.NETOPIA_PUBLIC_CER_PATH &&
  process.env.NETOPIA_PRIVATE_KEY_PATH
) {
  paymentProviders.push({
    resolve: './src/modules/netopia',
    id: 'netopia',
  })
}

// Rate prin TBI Bank (eCommerce API). Se activează când config-ul e complet
// (chei RSA + credențiale de la echipa de integrare TBI).
if (
  process.env.TBI_STORE_ID &&
  process.env.TBI_USERNAME &&
  process.env.TBI_PASSWORD &&
  process.env.TBI_PUBLIC_KEY_PATH &&
  process.env.TBI_PRIVATE_KEY_PATH
) {
  paymentProviders.push({
    resolve: './src/modules/tbi-pay',
    id: 'tbi',
  })
}

// Rate prin UniCredit Consumer Financing (ePOS). Staging: /TestOnline.
if (process.env.UNICREDIT_EPOS_EMAIL && process.env.UNICREDIT_EPOS_PASSWORD) {
  paymentProviders.push({
    resolve: './src/modules/unicredit-epos',
    id: 'unicredit',
    options: {
      baseUrl:
        process.env.UNICREDIT_EPOS_BASE_URL ||
        'https://epos.unicredit.ro/TestOnline',
      email: process.env.UNICREDIT_EPOS_EMAIL,
      password: process.env.UNICREDIT_EPOS_PASSWORD,
    },
  })
}

if (paymentProviders.length) {
  modules.push({
    resolve: '@medusajs/medusa/payment',
    options: {
      providers: paymentProviders,
    },
  })
}

if (process.env.RESEND_API_KEY) {
  modules.push({
    resolve: '@medusajs/medusa/notification',
    options: {
      providers: [
        {
          resolve: './src/modules/resend',
          id: 'resend',
          options: {
            channels: ['email'],
            api_key: process.env.RESEND_API_KEY,
            from: process.env.RESEND_FROM || 'onboarding@resend.dev',
            reply_to: process.env.RESEND_REPLY_TO,
          },
        },
      ],
    },
  })
}

if (redisUrl) {
  modules.push(
    {
      resolve: '@medusajs/medusa/cache-redis',
      options: { redisUrl },
    },
    {
      resolve: '@medusajs/medusa/event-bus-redis',
      options: { redisUrl },
    },
    {
      resolve: '@medusajs/medusa/workflow-engine-redis',
      options: { redis: { url: redisUrl } },
    },
    {
      resolve: '@medusajs/medusa/locking',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/locking-redis',
            id: 'locking-redis',
            is_default: true,
            options: { redisUrl },
          },
        ],
      },
    },
  )
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET || 'supersecret',
    },
  },
  modules,
})
