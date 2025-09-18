# Use uma imagem base oficial do Nginx com Alpine Linux (que é bem leve)
FROM nginx:alpine

# Copie os arquivos da aplicação (html, css, js, data) para o diretório padrão do Nginx
COPY . /usr/share/nginx/html

# Exponha a porta 80 (padrão do Nginx)
EXPOSE 80

# O comando para iniciar o Nginx já está na imagem base, então não precisamos de um CMD.
