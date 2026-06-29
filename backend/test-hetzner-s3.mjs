import { S3Client, ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

const ACCESS_KEY = 'N7C1H4HSVOIX9MYK5KD6'
const SECRET_KEY = 'WY3XeqScay3mqyoyhMuYdCW8NbrEwDdtfqYbJF87'

const locations = ['fsn1', 'nbg1', 'hel1']

for (const loc of locations) {
  const endpoint = `https://${loc}.your-objectstorage.com`
  const client = new S3Client({
    endpoint,
    region: 'eu-central-1',
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    forcePathStyle: true,
  })

  process.stdout.write(`\n[${loc}] ${endpoint}\n`)
  try {
    const res = await client.send(new ListBucketsCommand({}))
    console.log(`  ✓ Connected. Buckets: ${(res.Buckets || []).map(b => b.Name).join(', ') || '(none)'}`)
  } catch (e) {
    console.log(`  ✗ ${e.name}: ${e.message}`)
  }
}
