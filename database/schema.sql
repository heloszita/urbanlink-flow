-- UrbanLink Flow - estrutura inicial MySQL
-- A aplicacao tambem consegue criar as tabelas com sequelize.sync().

CREATE DATABASE IF NOT EXISTS urbanlink_flow
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE urbanlink_flow;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  perfil ENUM('Administrador','Gestor','Motorista','Cliente') NOT NULL DEFAULT 'Cliente',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  aprovado BOOLEAN NOT NULL DEFAULT TRUE,
  cpf_cnpj VARCHAR(20) NULL UNIQUE,
  telefone VARCHAR(30) NULL,
  cep VARCHAR(12) NULL,
  endereco_coleta VARCHAR(255) NULL,
  cnh VARCHAR(30) NULL,
  documento_cnh LONGTEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recuperacao_conta (
  usuario_id INT UNSIGNED NOT NULL PRIMARY KEY,
  codigo_hash CHAR(64) NULL UNIQUE,
  senha_redefinida_em DATETIME NULL,
  CONSTRAINT fk_recuperacao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS veiculos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  placa VARCHAR(10) NOT NULL UNIQUE,
  modelo VARCHAR(100) NOT NULL,
  cor VARCHAR(40) NULL,
  ano INT NULL,
  tipo ENUM('Moto','Carro','Van','Caminhão','Elétrico') NOT NULL,
  tipo_combustivel VARCHAR(40) NULL,
  capacidade_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
  volume_m3 DECIMAL(10,3) NULL,
  capacidade_tanque_l DECIMAL(8,2) NULL,
  status ENUM('Disponivel','Em Rota','Manutencao') NOT NULL DEFAULT 'Disponivel',
  motorista_id INT UNSIGNED NULL UNIQUE,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_veiculos_motorista FOREIGN KEY (motorista_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS posicoes_veiculo (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  veiculo_id INT UNSIGNED NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  velocidade_kmh DECIMAL(6,2) NULL,
  registrada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_posicoes_veiculo_data (veiculo_id, registrada_em),
  CONSTRAINT fk_posicoes_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS entregas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(24) NOT NULL UNIQUE,
  cliente_id INT UNSIGNED NOT NULL,
  motorista_id INT UNSIGNED NULL,
  veiculo_id INT UNSIGNED NULL,
  criada_por INT UNSIGNED NOT NULL,
  origem VARCHAR(255) NOT NULL,
  origem_latitude DECIMAL(10,7) NULL,
  origem_longitude DECIMAL(10,7) NULL,
  destino VARCHAR(255) NOT NULL,
  destino_latitude DECIMAL(10,7) NULL,
  destino_longitude DECIMAL(10,7) NULL,
  cep_entrega VARCHAR(12) NULL,
  bairro VARCHAR(100) NULL,
  cidade VARCHAR(100) NULL,
  destinatario_nome VARCHAR(120) NOT NULL,
  destinatario_telefone VARCHAR(30) NULL,
  tipo_veiculo ENUM('Moto','Carro','Van','Caminhão','Elétrico') NOT NULL,
  tipo_carga VARCHAR(80) NULL,
  quantidade_volumes INT UNSIGNED NOT NULL DEFAULT 1,
  peso_kg DECIMAL(10,2) NULL,
  volume_m3 DECIMAL(10,3) NULL,
  janela_inicio VARCHAR(5) NULL,
  janela_fim VARCHAR(5) NULL,
  observacoes TEXT NULL,
  status ENUM('Pendente','Aguardando coleta','Em trânsito','Saiu para entrega','Entregue','Problema','Cancelada') NOT NULL DEFAULT 'Pendente',
  distancia_km DECIMAL(10,2) NULL,
  tempo_estimado_min INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_entregas_status (status),
  INDEX idx_entregas_cliente (cliente_id),
  INDEX idx_entregas_motorista (motorista_id),
  CONSTRAINT fk_entregas_cliente FOREIGN KEY (cliente_id) REFERENCES usuarios(id),
  CONSTRAINT fk_entregas_motorista FOREIGN KEY (motorista_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_entregas_veiculo FOREIGN KEY (veiculo_id) REFERENCES veiculos(id) ON DELETE SET NULL,
  CONSTRAINT fk_entregas_criador FOREIGN KEY (criada_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS eventos_entrega (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entrega_id INT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  status VARCHAR(40) NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_eventos_entrega FOREIGN KEY (entrega_id) REFERENCES entregas(id) ON DELETE CASCADE,
  CONSTRAINT fk_eventos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rotas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  motorista_id INT UNSIGNED NULL,
  criada_por INT UNSIGNED NOT NULL,
  status ENUM('Planejada','Em andamento','Concluída','Cancelada') NOT NULL DEFAULT 'Planejada',
  entrega_ids JSON NOT NULL,
  distancia_total_km DECIMAL(10,2) NULL,
  tempo_estimado_min INT UNSIGNED NULL,
  velocidade_media_kmh DECIMAL(5,2) NOT NULL DEFAULT 30,
  origem_latitude DECIMAL(10,7) NOT NULL,
  origem_longitude DECIMAL(10,7) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_rotas_motorista FOREIGN KEY (motorista_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_rotas_criador FOREIGN KEY (criada_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chamados (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  assunto VARCHAR(120) NOT NULL,
  mensagem TEXT NOT NULL,
  resposta TEXT NULL,
  status ENUM('Aberto','Em atendimento','Resolvido') NOT NULL DEFAULT 'Aberto',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_chamados_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS simulacoes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  nome VARCHAR(120) NOT NULL,
  entrega_ids JSON NOT NULL,
  origem_latitude DECIMAL(10,7) NOT NULL,
  origem_longitude DECIMAL(10,7) NOT NULL,
  velocidade_base_kmh DECIMAL(5,2) NOT NULL,
  fator_congestionamento DECIMAL(4,2) NOT NULL,
  distancia_total_km DECIMAL(10,2) NOT NULL,
  tempo_base_min INT UNSIGNED NOT NULL,
  tempo_simulado_min INT UNSIGNED NOT NULL,
  acrescimo_min INT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_simulacoes_usuario (usuario_id),
  INDEX idx_simulacoes_data (created_at),
  CONSTRAINT fk_simulacoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;
