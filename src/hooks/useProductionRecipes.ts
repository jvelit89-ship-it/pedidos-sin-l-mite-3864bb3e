import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeQuery } from './useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
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

    // Solo insertamos el registro - el trigger auto_deduct_stock_on_waste_insert
    // se encarga automáticamente de actualizar el stock
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

    // Registrar movimiento de stock para trazabilidad
    await supabase
      .from('stock_movements')
      .insert({
        product_id: productId,
        company_id: companyId,
        movement_type: 'adjustment',
        quantity: -quantity,
        notes: `Merma: ${reason || 'Sin descripción'}`,
      });

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
  const { user, isAdmin: isUserAdmin } = useAuth();

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

    if (!user) {
      toast.error('Error de autenticación');
      return false;
    }

    // If operario, use pending production flow
    if (!isUserAdmin) {
      const { data: { session } } = await supabase.auth.getSession();
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { createClient } = await import('@supabase/supabase-js');
      const untypedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      if (session) {
        await untypedClient.auth.setSession(session);
      }

      // Add special notes for recipe-based production if needed
      const recipeNotes = notes ? `${notes} (Producción con Receta)` : '(Producción con Receta)';

      const { error } = await untypedClient
        .from('pending_production')
        .insert({
          product_id: outputProductId,
          quantity,
          notes: recipeNotes,
          requested_by: user.id,
          requested_by_name: user.name || 'Operario',
          company_id: companyId,
          status: 'pending',
        });

      if (error) {
        console.error('Error submitting for approval:', error);
        toast.error('Error al enviar para aprobación');
        return false;
      }

      toast.success('Producción enviada para aprobación del administrador');
      return true;
    }

    // Admins continue with direct production
    const producedBy = user.id;

    // Duplicate prevention: check for same product+quantity+user within last 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
    const { data: recentDuplicates } = await supabase
      .from('production_history')
      .select('id')
      .eq('product_id', outputProductId)
      .eq('quantity', quantity)
      .eq('produced_by', producedBy)
      .eq('company_id', companyId)
      .gte('produced_at', thirtySecondsAgo)
      .limit(1);

    if (recentDuplicates && recentDuplicates.length > 0) {
      toast.error('Producción duplicada detectada. Espera 30 segundos antes de registrar la misma cantidad del mismo producto.');
      return false;
    }

    const productRecipes = getRecipesForProduct(outputProductId);
    
    // Validar stock de materiales ANTES de insertar
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

    // SOLO insertamos el registro de producción
    // El trigger auto_update_stock_on_production se encarga de:
    // 1. Aumentar el stock del producto producido
    // 2. Deducir los materiales de entrada según las recetas
    // 3. Registrar los movimientos de stock
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

    // Registrar movimiento de producción para trazabilidad
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

    // Registrar merma si hay (esto activa su propio trigger)
    if (wasteQuantity > 0 && productRecipes.length > 0) {
      await supabase
        .from('production_waste')
        .insert({
          company_id: companyId,
          product_id: productRecipes[0].input_product_id,
          quantity: wasteQuantity,
          reason: wasteReason || null,
          registered_by: producedBy,
        });
    }

    toast.success('Producción registrada con éxito');
    return true;
  }, [getRecipesForProduct]);

  return {
    produceWithRecipe,
    recipes,
  };
}
