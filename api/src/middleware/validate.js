/**
 * Zod Validation Middleware
 *
 * [AV-003] feat: product catalog API with Zod validation
 *
 * Wraps Zod schemas into Express middleware.
 * On validation failure, returns 400 with structured error details.
 * On success, replaces req[source] with the parsed (and transformed) values.
 *
 * Usage:
 *   router.get('/products', validate(productListQuery, 'query'), handler)
 *   router.get('/products/:slug', validate(productSlugParam, 'params'), handler)
 *   router.post('/admin/products', validate(createProductBody, 'body'), handler)
 */

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters.',
          details: errors,
        },
      });
    }

    // Replace with parsed values (includes defaults and transforms)
    req[source] = result.data;
    next();
  };
};

module.exports = { validate };
