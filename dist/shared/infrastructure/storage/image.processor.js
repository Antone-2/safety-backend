import sharp from "sharp";
import { IMAGE_PROCESSING } from "../../../config/constants.js";
export class ImageProcessor {
    async process(key, buffer) {
        const metadata = await sharp(buffer).metadata();
        const maxWidth = IMAGE_PROCESSING.MAX_WIDTH;
        const quality = IMAGE_PROCESSING.QUALITY;
        const thumbSizes = IMAGE_PROCESSING.THUMB_SIZES;
        const resized = buffer.length > 0 && metadata.width && metadata.width > maxWidth
            ? await sharp(buffer).resize(maxWidth, undefined, { withoutEnlargement: true }).toBuffer()
            : buffer;
        const original = await sharp(resized)
            .webp({ quality })
            .toBuffer();
        const thumbnails = await Promise.all(thumbSizes.map(async (size) => {
            const thumbnail = await sharp(resized)
                .resize(size, undefined, { withoutEnlargement: true })
                .webp({ quality })
                .toBuffer();
            return { size, buffer: thumbnail };
        }));
        return {
            original: {
                key: `${key}-original.webp`,
                url: "",
                width: metadata.width || 0,
                height: metadata.height || 0,
            },
            thumbnails: thumbnails.map((t) => ({
                size: t.size,
                key: `${key}-${t.size}px.webp`,
                url: "",
            })),
        };
    }
}
export const imageProcessor = new ImageProcessor();
