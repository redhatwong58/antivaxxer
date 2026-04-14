/**
 * Image Upload Service — S3 + Sharp
 *
 * [AV-022] feat: S3 image upload with CloudFront CDN
 *
 * Handles product image uploads:
 * 1. Accepts uploaded file buffer
 * 2. Generates 3 sizes (thumb 200px, card 600px, full 1200px) in webp
 * 3. Stores original file as backup
 * 4. Uploads all to S3
 * 5. Returns CloudFront URLs
 *
 * S3 key structure:
 *   images/products/{productId}/originals/{filename}
 *   images/products/{productId}/thumb-{hash}.webp
 *   images/products/{productId}/card-{hash}.webp
 *   images/products/{productId}/full-{hash}.webp
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.S3_BUCKET_NAME;
const CDN_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

const SIZES = {
  thumb: { width: 200, height: 200, fit: 'cover' },
  card: { width: 600, height: 600, fit: 'cover' },
  full: { width: 1200, height: 1200, fit: 'inside' },
};

/**
 * Upload a product image. Generates 3 webp sizes + stores original.
 * @param {Buffer} buffer — Raw file buffer from multer
 * @param {string} originalName — Original filename
 * @param {string} productId — Product UUID
 * @returns {Object} URLs for each size
 */
async function uploadProductImage(buffer, originalName, productId) {
  if (!BUCKET) {
    throw new Error('S3_BUCKET_NAME not configured. Set it in .env to enable image uploads.');
  }

  const hash = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName);
  const prefix = `images/products/${productId}`;

  // 1. Store original as backup
  const originalKey = `${prefix}/originals/${hash}${ext}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: originalKey,
    Body: buffer,
    ContentType: `image/${ext.replace('.', '') || 'jpeg'}`,
  }));

  // 2. Generate and upload each webp size
  const urls = {};
  for (const [sizeName, config] of Object.entries(SIZES)) {
    const webpBuffer = await sharp(buffer)
      .resize(config.width, config.height, { fit: config.fit, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const key = `${prefix}/${sizeName}-${hash}.webp`;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: webpBuffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    urls[sizeName] = CDN_DOMAIN
      ? `https://${CDN_DOMAIN}/${key}`
      : `https://${BUCKET}.s3.amazonaws.com/${key}`;
  }

  return {
    originalKey,
    urls,
    // The "card" size is the default URL stored on the product_images record
    primaryUrl: urls.card,
  };
}

/**
 * Delete all sizes of an image from S3.
 * @param {string} productId
 * @param {string} imageUrl — The stored URL (card size)
 */
async function deleteProductImage(productId, imageUrl) {
  if (!BUCKET) return;

  // Extract the hash from the URL to find all related files
  const match = imageUrl.match(/card-([a-f0-9]+)\.webp/);
  if (!match) return;

  const hash = match[1];
  const prefix = `images/products/${productId}`;

  const keysToDelete = [
    `${prefix}/thumb-${hash}.webp`,
    `${prefix}/card-${hash}.webp`,
    `${prefix}/full-${hash}.webp`,
  ];

  // Also try to delete original (any common extension)
  for (const ext of ['.jpg', '.jpeg', '.png', '.gif', '.webp']) {
    keysToDelete.push(`${prefix}/originals/${hash}${ext}`);
  }

  await Promise.allSettled(
    keysToDelete.map((Key) =>
      s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key }))
    )
  );
}

module.exports = { uploadProductImage, deleteProductImage };
