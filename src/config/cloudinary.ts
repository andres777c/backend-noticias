import { v2 as cloudinary } from 'cloudinary';

import logger from '../utils/logger.js';

/**
 * Cloudinary configuration.
 * Credentials are read from the CLOUDINARY_URL environment variable,
 * which the SDK parses automatically on import.
 */
cloudinary.config({ secure: true });

/**
 * Uploads an image buffer to Cloudinary and returns its public HTTPS URL.
 *
 * The file never touches the local disk: multer keeps it in memory and the
 * buffer is streamed straight to Cloudinary. This is required on hosting
 * platforms with an ephemeral filesystem, where uploaded files would be lost
 * on every restart or redeploy.
 *
 * @param buffer - Raw image bytes provided by multer.
 * @param folder - Destination folder inside the Cloudinary account.
 * @returns The secure URL of the stored image.
 * @throws {Error} If Cloudinary rejects the upload or returns no result.
 */
export async function uploadImageBuffer(
  buffer: Buffer,
  folder = 'noticias'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error || !result) {
          logger.error({ err: error }, 'Cloudinary upload failed');
          reject(error ?? new Error('Cloudinary returned no result'));
          return;
        }
        resolve(result.secure_url);
      }
    );

    stream.end(buffer);
  });
}

export default cloudinary;
