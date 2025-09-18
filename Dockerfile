# Use a imagem oficial do Nginx como base
FROM nginx:alpine

# Remove a configuração padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia a configuração customizada do Nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Copia os arquivos do seu projeto
COPY . /usr/share/nginx/html

# Exponha a porta 80 para permitir o acesso ao servidor web
EXPOSE 80

# Comando para iniciar o Nginx quando o contêiner for iniciado
CMD ["nginx", "-g", "daemon off;"]