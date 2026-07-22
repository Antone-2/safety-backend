declare module "qrcode" {
  export function toDataURL(
    input: string,
    options?: {
      width?: number;
      margin?: number;
      errorCorrectionLevel?: string;
    },
  ): Promise<string>;
}
