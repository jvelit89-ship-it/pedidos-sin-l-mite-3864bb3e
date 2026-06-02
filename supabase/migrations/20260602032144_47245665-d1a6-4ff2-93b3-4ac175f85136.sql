-- Primero limpiamos posibles espacios en blanco que arruinen las restricciones
UPDATE customers SET 
    document_id = TRIM(document_id),
    name = TRIM(name),
    phone = TRIM(phone);

-- Convertimos cadenas vacías a NULL para que las restricciones UNIQUE funcionen correctamente (múltiples NULLs están permitidos)
UPDATE customers SET document_id = NULL WHERE document_id = '';
UPDATE customers SET phone = NULL WHERE phone = '';

-- Añadimos las restricciones de unicidad
-- 1. Unicidad por Documento (DNI/RUC) por empresa
ALTER TABLE customers 
ADD CONSTRAINT customers_company_document_unique UNIQUE (company_id, document_id);

-- 2. Unicidad por Nombre y Teléfono por empresa
ALTER TABLE customers 
ADD CONSTRAINT customers_company_name_phone_unique UNIQUE (company_id, name, phone);
