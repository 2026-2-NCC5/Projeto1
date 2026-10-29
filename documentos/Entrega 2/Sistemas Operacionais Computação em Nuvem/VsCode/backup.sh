DIR_ORIGEM="/var/www/sisa-backend/documentos/Entrega 2/Sistemas Operacionais Computação em Nuvem/logs"
DIR_DESTINO="/var/www/sisa-backend/documentos/Entrega 2/Sistemas Operacionais Computação em Nuvem/backups"
DATA_ATUAL=$(date +"%Y-%m-%d_%H-%M-%S")
NOME_ARQUIVO="backup_logs_$DATA_ATUAL.tar.gz"

tar -czf "$DIR_DESTINO/$NOME_ARQUIVO" "$DIR_ORIGEM"

echo "Backup concluído: $NOME_ARQUIVO"