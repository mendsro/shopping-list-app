-- Corrige as categorias dos itens existentes a partir do catálogo informado.
update public.list_items
set category = case
  when lower(trim(name)) in ('macarrão', 'arroz', 'azeite') then 'Almoço/Jantar'
  when lower(trim(name)) in ('suco', 'chá', 'cha') then 'Bebidas'
  when lower(trim(name)) in ('pão', 'queijo', 'iogurtes', 'café', 'requeijão', 'kiwi', 'água') then 'Café da manhã'
  when lower(trim(name)) in ('morango', 'tomate', 'banana', 'espinafre', 'uva', 'batata') then 'Frutas/Legumes'
  when lower(trim(name)) in ('doce de leite', 'chocolate', 'bolachas') then 'Guloseimas'
  when lower(trim(name)) in ('papel higiênico', 'absorvente', 'saco de lixo', 'lava tudo', 'luvas', 'detergente', 'sabão em pó', 'cif', 'desodorante', 'fio dental') then 'Higiene'
  when lower(trim(name)) in ('molho tomate', 'molho de tomate', 'páprica', 'sal', 'ketchup', 'alho', 'limão') then 'Molhos/Temperos'
  when lower(trim(name)) in ('ovos', 'frango', 'carne moída', 'bife', 'camarão', 'porco', 'carne filé', 'carne mista') then 'Proteína'
  else category
end
where lower(trim(name)) in (
  'macarrão', 'arroz', 'azeite', 'suco', 'chá', 'cha', 'pão', 'queijo', 'iogurtes',
  'café', 'requeijão', 'kiwi', 'água', 'morango', 'tomate', 'banana', 'espinafre', 'uva',
  'batata', 'doce de leite', 'chocolate', 'bolachas', 'papel higiênico', 'absorvente',
  'saco de lixo', 'lava tudo', 'luvas', 'detergente', 'sabão em pó', 'cif', 'desodorante',
  'fio dental', 'molho tomate', 'molho de tomate', 'páprica', 'sal', 'ketchup', 'alho',
  'limão', 'ovos', 'frango', 'carne moída', 'bife', 'camarão', 'porco', 'carne filé', 'carne mista'
);