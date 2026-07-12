import { z } from "zod";
export function validate(schema) {
    return (req, res, next) => {
        const result = z.object({ body: schema }).safeParse({ body: req.body });
        if (!result.success) {
            return res.status(400).json({
                error: {
                    code: "VALIDATION_FAILED",
                    message: "Invalid request data",
                    details: result.error.errors,
                },
            });
        }
        req.body = result.data.body;
        next();
    };
}
