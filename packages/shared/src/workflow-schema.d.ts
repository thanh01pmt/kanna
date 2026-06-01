import { z } from "zod";
/**
 * Defines a rule for how one artifact depends on another.
 * Used during static extraction to build the dependency graph.
 */
export declare const ArtifactDependencyRuleSchema: z.ZodObject<{
    sourcePattern: z.ZodString;
    relationship: z.ZodString;
    condition: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ArtifactDependencyRule = z.infer<typeof ArtifactDependencyRuleSchema>;
/**
 * Defines the shape and expectation of a generated or tracked artifact.
 */
export declare const ArtifactDefinitionSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    pattern: z.ZodString;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodObject<{
        sourcePattern: z.ZodString;
        relationship: z.ZodString;
        condition: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type ArtifactDefinition = z.infer<typeof ArtifactDefinitionSchema>;
/**
 * The full manifest extracted from markdown files representing an immutable workflow version.
 */
export declare const WorkflowManifestSchema: z.ZodObject<{
    version: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    artifacts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        pattern: z.ZodString;
        dependencies: z.ZodOptional<z.ZodArray<z.ZodObject<{
            sourcePattern: z.ZodString;
            relationship: z.ZodString;
            condition: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type WorkflowManifest = z.infer<typeof WorkflowManifestSchema>;
