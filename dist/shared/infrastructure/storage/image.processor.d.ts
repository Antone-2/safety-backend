export interface ImageSet {
    original: {
        key: string;
        url: string;
        width: number;
        height: number;
    };
    thumbnails: {
        size: number;
        key: string;
        url: string;
    }[];
}
export declare class ImageProcessor {
    process(key: string, buffer: Buffer): Promise<ImageSet>;
}
export declare const imageProcessor: ImageProcessor;
