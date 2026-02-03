import { z } from "zod";

export type ToolDefinition<TInput = unknown> = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  schema: z.ZodTypeAny;
  execute: (input: TInput) => Promise<unknown>;
};

type JsonSchema = Record<string, unknown>;

function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return unwrapSchema(schema._def.innerType);
  }
  if (schema instanceof z.ZodNullable) {
    return unwrapSchema(schema._def.innerType);
  }
  return schema;
}

function zodToJsonSchemaMinimal(schema: z.ZodTypeAny): JsonSchema {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof z.ZodString) {
    return { type: "string" };
  }
  if (unwrapped instanceof z.ZodNumber) {
    return { type: "number" };
  }
  if (unwrapped instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }
  if (unwrapped instanceof z.ZodEnum) {
    return { type: "string", enum: unwrapped._def.values };
  }
  if (unwrapped instanceof z.ZodUnion) {
    return { anyOf: unwrapped._def.options.map(zodToJsonSchemaMinimal) };
  }
  if (unwrapped instanceof z.ZodObject) {
    const shape = unwrapped.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodTypeAny;
      properties[key] = zodToJsonSchemaMinimal(fieldSchema);

      if (
        !(fieldSchema instanceof z.ZodOptional) &&
        !(fieldSchema instanceof z.ZodDefault) &&
        !(fieldSchema instanceof z.ZodNullable)
      ) {
        required.push(key);
      }
    }

    const jsonSchema: JsonSchema = {
      type: "object",
      properties,
    };

    if (required.length > 0) {
      jsonSchema.required = required;
    }

    return jsonSchema;
  }

  return { type: "string" };
}

export function defineTool<TSchema extends z.ZodTypeAny>(
  tool: Omit<ToolDefinition<z.infer<TSchema>>, "parameters"> & { schema: TSchema }
): ToolDefinition<z.infer<TSchema>> {
  const parameters = zodToJsonSchemaMinimal(tool.schema);
  return {
    ...tool,
    parameters,
  };
}
