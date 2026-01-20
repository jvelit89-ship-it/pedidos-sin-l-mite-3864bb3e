import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { toast } from 'sonner';

interface ProductionRecipe {
  id: string;
  company_id: string;
  output_product_id: string;
  input_product_id: string;
  quantity_ratio: number;
  is_active: boolean;
  created_at: string;
  output_product?: {
    name: string;
    sku: string;
  };
  input_product?: {
    name: string;
    sku: string;
    stock: number;
  };
}

interface ProductionWaste {
  id: string;
  company_id: string;
  product_id: string;
  quantity: number;
  reason: string | null;
  registered_by: string | null;
  created_at: string;
  products?: {
    name: string;
    sku: string;
  };
  profiles?: {
    name: string;
  };
}

async function getUserCompanyId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();
  
  return profile?.company_id || null;
}

export function useProductionRecipes() {
  const { data: recipes, loading, error, refetch } = useRealtimeQuery<ProductionRecipe>('production_recipes', {
    select: '*, output_product:products!production_recipes_output_product_id_fkey(name, sku), input_product:products!production_recipes_input_product_id_fkey(name, sku, stock)',
    orderBy: { column: 'created_at', ascending: false },
  });

  const addRecipe = useCallback(async (
    outputProductId: string,
    inputProductId: string,
    quantityRatio: number = 1
  ) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa del usuario');
      return null;
    }

    const { data, error } = await supabase
      .from('production_recipes')
      .insert({
        company_id: companyId,
        output_product_id: outputProductId,
        input_product_id: inputProductId,
        quantity_ratio: quantityRatio,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding recipe:', error);
      if (error.code === '23505') {
        toast.error('Esta receta ya existe');
      } else {
        toast.error('Error al crear receta');
      }
      return null;
    }

    toast.success('Receta de producción creada');
    refetch();
    return data;
  }, [refetch]);

  const deleteRecipe = useCallback(async (recipeId: string) => {
    const { error } = await supabase
      .from('production_recipes')
      .delete()
      .eq('id', recipeId);

    if (error) {
      console.error('Error deleting recipe:', error);
      toast.error('Error al eliminar receta');
      return false;
    }

    toast.success('Receta eliminada');
    refetch();
    return true;
  }, [refetch]);

  const getRecipesForProduct = useCallback((outputProductId: string) => {
    return (recipes || []).filter(r => r.output_product_id === outputProductId && r.is_active);
  }, [recipes]);

  return {
    recipes: recipes || [],
    loading,
    error,
    refetch,
    addRecipe,
    deleteRecipe,
    getRecipesForProduct,
  };
}

export function useProductionWaste() {
  const { data: waste, loading, error, refetch } = useRealtimeQuery<ProductionWaste>('production_waste', {
    select: '*, products(name, sku)',
    orderBy: { column: 'created_at', ascending: false },
  });

  const registerWaste = useCallback(async (
    productId: string,
    quantity: number,
    reason?: string
  ) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa del usuario');
      return false;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('production_waste')
      .insert({
        company_id: companyId,
        product_id: productId,
        quantity,
        reason: reason || null,
        registered_by: user?.id || null,
      });

    if (error) {
      console.error('Error registering waste:', error);
      toast.error('Error al registrar merma');
      return false;
    }

    // Deduct from stock
    const { data: product } = await supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
      .single();

    if (product) {
      const newStock = Math.max(0, product.stock - quantity);
      await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId);

      // Create stock movement for waste
      await supabase
        .from('stock_movements')
        .insert({
          product_id: productId,
          company_id: companyId,
          movement_type: 'adjustment',
          quantity: -quantity,
          notes: `Merma: ${reason || 'Sin descripción'}`,
        });
    }

    toast.success('Merma registrada');
    refetch();
    return true;
  }, [refetch]);

  return {
    waste: waste || [],
    loading,
    error,
    refetch,
    registerWaste,
  };
}

export function useAdvancedProduction() {
  const { getRecipesForProduct, recipes } = useProductionRecipes();
  const { registerWaste } = useProductionWaste();

  const produceWithRecipe = useCallback(async (
    outputProductId: string,
    quantity: number,
    wasteQuantity: number = 0,
    wasteReason?: string,
    notes?: string
  ) => {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      toast.error('Error: No se encontró la empresa del usuario');
      return false;
    }

    const productRecipes = getRecipesForProduct(outputProductId);
    
    // Check if we have enough input materials
    for (const recipe of productRecipes) {
      const requiredAmount = quantity * recipe.quantity_ratio;
      
      const { data: inputProduct } = await supabase
        .from('products')
        .select('stock, name')
        .eq('id', recipe.input_product_id)
        .single();

      if (!inputProduct) {
        toast.error(`Material no encontrado`);
        return false;
      }

      if (inputProduct.stock < requiredAmount) {
        toast.error(`Stock insuficiente de ${inputProduct.name}. Necesitas ${requiredAmount}, tienes ${inputProduct.stock}`);
        return false;
      }
    }

    // Deduct input materials
    for (const recipe of productRecipes) {
      const requiredAmount = quantity * recipe.quantity_ratio;
      
      const { data: inputProduct } = await supabase
        .from('products')
        .select('stock')
        .eq('id', recipe.input_product_id)
        .single();

      if (inputProduct) {
        const newStock = inputProduct.stock - requiredAmount;
        await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', recipe.input_product_id);

        // Create stock movement for input deduction
        await supabase
          .from('stock_movements')
          .insert({
            product_id: recipe.input_product_id,
            company_id: companyId,
            movement_type: 'adjustment',
            quantity: -requiredAmount,
            notes: `Consumido en producción`,
          });
      }
    }

    // Get current user id
    const { data: { user } } = await supabase.auth.getUser();
    const producedBy = user?.id || null;

    // Add production record for output product
    const { data: productionData, error: historyError } = await supabase
      .from('production_history')
      .insert({
        product_id: outputProductId,
        quantity,
        company_id: companyId,
        notes: notes || null,
        produced_by: producedBy,
      })
      .select()
      .single();

    if (historyError) {
      toast.error('Error al registrar producción');
      console.error('Error adding production:', historyError);
      return false;
    }

    // Add stock movement for production
    await supabase
      .from('stock_movements')
      .insert({
        product_id: outputProductId,
        company_id: companyId,
        movement_type: 'production',
        quantity: quantity,
        reference_id: productionData?.id || null,
        notes: notes || null,
      });

    // Update output product stock
    const { data: outputProduct } = await supabase
      .from('products')
      .select('stock')
      .eq('id', outputProductId)
      .single();

    if (outputProduct) {
      const newStock = outputProduct.stock + quantity;
      await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', outputProductId);
    }

    // Register waste if any
    if (wasteQuantity > 0 && productRecipes.length > 0) {
      // Register waste for the first input material (the one being transformed)
      await registerWaste(productRecipes[0].input_product_id, wasteQuantity, wasteReason);
    }

    toast.success('Producción registrada con éxito');
    return true;
  }, [getRecipesForProduct, registerWaste]);

  return {
    produceWithRecipe,
    recipes,
  };
}
