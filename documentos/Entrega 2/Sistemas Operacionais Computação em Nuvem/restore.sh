DIR_BACKUPS="./backups"
DIR_DESTINO="./logs_restaurados"

# Encontra o backup mais recente
ULTIMO_BACKUP=$(ls -t $DIR_BACKUPS/*.tar.gz 2>/dev/null | head -1)

if [ -z "$ULTIMO_BACKUP" ]; then
    echo "Nenhum backup encontrado na pasta $DIR_BACKUPS."
    exit 1
fi

mkdir -p "$DIR_DESTINO"

# Extrai o ficheiro
tar -xzf "$ULTIMO_BACKUP" -C "$DIR_DESTINO"

echo "Restauração concluída com sucesso!"
echo "Ficheiro restaurado: $ULTIMO_BACKUP"
echo "Destino: $DIR_DESTINO"