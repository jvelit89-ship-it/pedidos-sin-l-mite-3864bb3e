import { useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type ProductRow = {
  id: string;
  company_id: string;
  name: string;
  sku: string;
};

type MaterialSpec = {
  name: string;
  sku: string;
  note: string;
};

type DesiredRecipe = {
  outputProductId: string;
  inputProductId: string;
  quantityRatio: number;
};

const BOOTSTRAP_VERSION = 'production-recipes-v3';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isSantaMaria8L = (product: ProductRow) => {
  const name = normalize(product.name);
  return (
    (product.sku === 'P001' && name.includes('agua') && name.includes('8l')) ||
    (name.includes('agua santa maria') && name.includes('8l'))
  );
};

const isSantaMaria20LBidon = (product: ProductRow) => {
  const name = normalize(product.name);
  return name.includes('agua santa maria') && name.includes('20l') && name.includes('bidon');
};

const materialMatches = (product: ProductRow, spec: MaterialSpec) => {
  return product.sku === spec.sku || normalize(product.name) === normalize(spec.name);
};

interface ProductionRecipeBootstrapProps {
  children: ReactNode;
}

/**
 * Repara únicamente recetas base solicitadas para Santa María cuando faltan.
 * No cambia stocks existentes, ratios existentes ni relaciones ya configuradas.
 * Los materiales nuevos se crean con stock 0 para que el stock físico sea
 * cargado explícitamente desde Inventario.
 */
export function ProductionRecipeBootstrap({ children }: ProductionRecipeBootstrapProps) {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const syncRecipes = async () => {
      if (!user?.companyId || (!isAdmin && !isSuperAdmin)) {
        if (!cancelled) setReady(true);
        return;
      }

      const cacheKey = `${BOOTSTRAP_VERSION}:${user.companyId}`;
      if (sessionStorage.getItem(cacheKey) === 'done') {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const companyId = user.companyId;
        const { data: productData, error: productsError } = await supabase
          .from('products')
          .select('id, company_id, name, sku')
          .eq('company_id', companyId);

        if (productsError) throw productsError;

        const products: ProductRow[] = (productData || []) as ProductRow[];
        const output8L = products.find(isSantaMaria8L);
        const output20L = products.find(isSantaMaria20LBidon);
        const desiredRecipes: DesiredRecipe[] = [];
        let changed = false;

        const ensureMaterial = async (spec: MaterialSpec): Promise<ProductRow> => {
          const existing = products.find((product) => materialMatches(product, spec));
          if (existing) return existing;

          const { data, error } = await supabase
            .from('products')
            .insert({
              company_id: companyId,
              name: spec.name,
              sku: spec.sku,
              category: 'Materia Prima',
              stock: 0,
              min_stock: 0,
              stock_critical_level: 0,
              price: 0,
              notes: spec.note,
              product_type: 'raw_material',
            })
            .select('id, company_id, name, sku')
            .single();

          if (error) {
            // Si otra sesión lo creó al mismo tiempo, recuperar el registro y continuar.
            if (error.code === '23505') {
              const { data: concurrentMaterial, error: concurrentError } = await supabase
                .from('products')
                .select('id, company_id, name, sku')
                .eq('company_id', companyId)
                .eq('sku', spec.sku)
                .maybeSingle();

              if (concurrentError || !concurrentMaterial) throw error;
              const row = concurrentMaterial as ProductRow;
              products.push(row);
              return row;
            }
            throw error;
          }

          const row = data as ProductRow;
          products.push(row);
          changed = true;
          return row;
        };

        if (output8L) {
          const etiqueta8L = await ensureMaterial({
            name: 'Etiquetas 8L',
            sku: 'MP-ETI8L',
            note: 'Materia prima para Agua Santa Maria 8L. Consumo: 1 etiqueta por unidad producida.',
          });
          const termo8L = await ensureMaterial({
            name: 'Termocontraíble 8L',
            sku: 'MP-TERMO8L',
            note: 'Materia prima para Agua Santa Maria 8L. Consumo: 1 termocontraíble por unidad producida.',
          });

          desiredRecipes.push(
            { outputProductId: output8L.id, inputProductId: etiqueta8L.id, quantityRatio: 1 },
            { outputProductId: output8L.id, inputProductId: termo8L.id, quantityRatio: 1 },
          );
        }

        // También conserva el requerimiento ya solicitado para bidón 20L.
        if (output20L) {
          const termo20L = await ensureMaterial({
            name: 'Termocontraíble 20L (caño y tapa)',
            sku: 'MP-TERMO20L',
            note: 'Materia prima para bidones Agua Santa María 20L. Consumo inicial: 1 unidad por bidón producido.',
          });

          desiredRecipes.push({
            outputProductId: output20L.id,
            inputProductId: termo20L.id,
            quantityRatio: 1,
          });
        }

        if (desiredRecipes.length > 0) {
          const outputIds = [...new Set(desiredRecipes.map((recipe) => recipe.outputProductId))];
          const { data: currentRecipes, error: recipesError } = await supabase
            .from('production_recipes')
            .select('id, output_product_id, input_product_id')
            .eq('company_id', companyId)
            .in('output_product_id', outputIds);

          if (recipesError) throw recipesError;

          const existingLinks = new Set(
            (currentRecipes || []).map(
              (recipe: any) => `${recipe.output_product_id}:${recipe.input_product_id}`,
            ),
          );

          const missingRecipes = desiredRecipes
            .filter(
              (recipe) =>
                !existingLinks.has(`${recipe.outputProductId}:${recipe.inputProductId}`),
            )
            .map((recipe) => ({
              company_id: companyId,
              output_product_id: recipe.outputProductId,
              input_product_id: recipe.inputProductId,
              quantity_ratio: recipe.quantityRatio,
              is_active: true,
            }));

          if (missingRecipes.length > 0) {
            const { error: insertRecipesError } = await supabase
              .from('production_recipes')
              .insert(missingRecipes);

            if (insertRecipesError && insertRecipesError.code !== '23505') {
              throw insertRecipesError;
            }
            changed = true;
          }
        }

        sessionStorage.setItem(cacheKey, 'done');
        if (changed) {
          toast.success('Recetas de producción sincronizadas');
        }
      } catch (error) {
        console.error('Error syncing production recipes:', error);
        toast.error('No se pudieron sincronizar las materias primas de producción');
      } finally {
        if (!cancelled) setReady(true);
      }
    };

    void syncRecipes();
    return () => {
      cancelled = true;
    };
  }, [user?.companyId, isAdmin, isSuperAdmin]);

  if (!ready) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Preparando recetas de producción...
      </div>
    );
  }

  return <>{children}</>;
}
