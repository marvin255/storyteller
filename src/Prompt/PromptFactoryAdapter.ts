/**
 * This interface defines object that adapts a prompt factory to a specific template engine, allowing for the rendering of templates and checking their existence.
 */
export interface PromptFactoryAdapter {
    /** Renders a template with the given name and data, returning the rendered string */
    render(templateName: string, data: Record<string, unknown>): Promise<string>;

    /** Checks if a template with the given name exists */
    doesTemplateExist(templateName: string): Promise<boolean>;
}
