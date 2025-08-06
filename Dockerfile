# Use a imagem oficial do Nginx como base
FROM nginx:alpine

# Copie os arquivos estáticos do seu projeto para o diretório padrão do Nginx
COPY . /usr/share/nginx/html

# Exponha a porta 80 para permitir o acesso ao servidor web
EXPOSE 80

# Comando para iniciar o Nginx quando o contêiner for iniciado
CMD ["nginx", "-g", "daemon off;"]