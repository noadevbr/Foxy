import fs from 'node:fs';
import { resolve } from 'node:path';
import { z, ZodDefault } from 'zod';
import type { ZodType, ZodTypeDef } from 'zod';

type CacheRegistry = Record<string, ZodType<unknown, ZodTypeDef, unknown>>;

class CacheController<TRegistry extends CacheRegistry> {
	private cacheDir: string;
	private schemas: TRegistry;

	constructor(schemas: TRegistry, cacheDir?: string) {
		this.cacheDir = resolve(cacheDir ?? './.cache', 'foxy_cache');
		this.schemas = schemas;
		this.ensureCacheDirExists();
	}

	private ensureCacheDirExists() {
		if (!fs.existsSync(this.cacheDir)) {
			try {
				fs.mkdirSync(this.cacheDir, { recursive: true });
			} catch (error) {
				throw new Error(
					`Failed to create cache directory: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}

	public saveCache<K extends keyof TRegistry>(
		filename: K,
		data: z.infer<TRegistry[K]>,
	): void {
		const schema = this.schemas[filename];
		if (!schema) {
			throw new Error(`Schema not found for key: ${String(filename)}`);
		}

		const validation = schema.safeParse(data);
		if (!validation.success) {
			console.warn(
				`WARNING: Data being saved for '${String(filename)}' does not validate against the schema. Errors:`,
				validation.error.format(),
			);
		}

		const filePath = resolve(this.cacheDir, `${String(filename)}.json.cache`);
		try {
			fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
		} catch (error) {
			throw new Error(
				`Failed to save cache '${String(filename)}': ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	public loadCache<K extends keyof TRegistry>(
		filename: K,
		defaultValue?: z.infer<TRegistry[K]>,
	): z.infer<TRegistry[K]> {
		const schema = this.schemas[filename];
		if (!schema) {
			throw new Error(`Schema not found for key: ${String(filename)}`);
		}

		const filePath = resolve(this.cacheDir, `${String(filename)}.json.cache`);

		let effectiveDefaultValue = defaultValue;

		if (
			effectiveDefaultValue === undefined &&
			schema._def &&
			'typeName' in schema._def &&
			schema._def.typeName === ZodDefault.name &&
			'defaultValue' in schema._def &&
			typeof schema._def.defaultValue === 'function'
		) {
			try {
				effectiveDefaultValue = (
					schema._def as ZodDefault<ZodType<unknown>>['_def']
				).defaultValue();
			} catch (e) {}
		}

		if (fs.existsSync(filePath)) {
			try {
				const rawData = fs.readFileSync(filePath, 'utf8');
				const parsed = JSON.parse(rawData);

				const result = schema.safeParse(parsed);

				if (!result.success) {
					if (effectiveDefaultValue !== undefined) {
						this.saveCache(filename, effectiveDefaultValue);
						return effectiveDefaultValue;
					}
					throw new Error(
						`Error validating cache '${String(filename)}' and no default value was provided or defined in the schema.`,
					);
				}

				return result.data;
			} catch (error) {
				if (effectiveDefaultValue !== undefined) {
					this.saveCache(filename, effectiveDefaultValue);
					return effectiveDefaultValue;
				}
				throw new Error(
					`Error processing cache '${String(filename)}': ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		if (effectiveDefaultValue !== undefined) {
			this.saveCache(filename, effectiveDefaultValue);
			return effectiveDefaultValue;
		}

		throw new Error(
			`Cache '${String(filename)}' not found and no default value was provided or defined in the schema.`,
		);
	}

	public cacheExists<K extends keyof TRegistry>(filename: K): boolean {
		const filePath = resolve(this.cacheDir, `${String(filename)}.json.cache`);
		return fs.existsSync(filePath);
	}

	public clearCache<K extends keyof TRegistry>(filename: K): void {
		const filePath = resolve(this.cacheDir, `${String(filename)}.json.cache`);
		if (fs.existsSync(filePath)) {
			try {
				fs.unlinkSync(filePath);
			} catch (error) {}
		}
	}

	public clearAllCache(): void {
		if (fs.existsSync(this.cacheDir)) {
			try {
				const files = fs.readdirSync(this.cacheDir);
				for (const file of files) {
					if (file.endsWith('.json.cache')) {
						const filePath = resolve(this.cacheDir, file);
						try {
							fs.unlinkSync(filePath);
						} catch (unlinkError) {}
					}
				}
			} catch (error) {}
		}
	}
	public hasExistingCache<K extends keyof TRegistry>(filename: K): boolean {
		const filePath = resolve(this.cacheDir, `${String(filename)}.json.cache`);
		return fs.existsSync(filePath);
	}

	public createCache<K extends keyof TRegistry>(
		filename: K,
		defaultValue?: z.infer<TRegistry[K]>,
	): z.infer<TRegistry[K]> {
		const schema = this.schemas[filename];
		if (!schema) {
			throw new Error(`Schema not found for key: ${String(filename)}`);
		}

		let valueToSave = defaultValue;

		if (valueToSave === undefined && schema instanceof z.ZodDefault) {
			try {
				valueToSave = schema._def.defaultValue();
			} catch {}
		}

		if (valueToSave === undefined) {
			throw new Error(
				`No default value provided or defined in schema for '${String(filename)}'`,
			);
		}

		this.saveCache(filename, valueToSave);
		return valueToSave;
	}
}

export { CacheController };
