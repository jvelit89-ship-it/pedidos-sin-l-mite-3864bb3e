# Casos de prueba - Producción con Receta

## Caso 1: Agua Santa María 8L

Configurar stock inicial de prueba:

- Botellas PET 8L Vacías: 150
- Etiquetas 8L: 150
- Termocontraíble 8L: 150
- Agua Santa María 8L: 20

Registrar producción de 100 unidades.

Resultado esperado:

- Agua Santa María 8L: 120
- Botellas PET 8L Vacías: 50
- Etiquetas 8L: 50
- Termocontraíble 8L: 50
- Un movimiento de stock negativo por cada materia prima consumida.

## Caso 2: Bidón Agua Santa María 20L

Configurar stock inicial de prueba:

- Termocontraíble 20L (caño y tapa): 120
- Producto final 20L: stock conocido antes de la prueba

Registrar producción de 100 unidades.

Resultado esperado:

- El Producto Final 20L aumenta en 100 unidades.
- Termocontraíble 20L (caño y tapa) disminuye en 100 unidades si su ratio es 1:1.
- Cualquier otra materia prima activa asociada a esa receta se descuenta según su `quantity_ratio`.

## Caso 3: stock insuficiente

Dejar cualquiera de las materias primas por debajo de la cantidad necesaria e intentar producir.

Resultado esperado:

- La producción falla completa.
- No aumenta el Producto Final.
- No se descuenta parcialmente ninguna materia prima.

## Caso 4: ratios distintos de 1

Ejemplo de receta:

- Material A: ratio 1
- Material B: ratio 0.5
- Material C: ratio 2

Producir 100 unidades.

Resultado esperado:

- Material A: -100
- Material B: -50
- Material C: -200

## Caso 5: producción simultánea

Lanzar dos registros de producción que compitan por la misma materia prima y cuyo total supere el stock disponible.

Resultado esperado:

- Solo las producciones que puedan cubrirse con el stock real deben completarse.
- La siguiente operación debe fallar por stock insuficiente y nunca llevar el inventario a un consumo mayor que la existencia disponible.
