FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY index.html /usr/share/nginx/html/index.html
COPY assets /usr/share/nginx/html/assets
# create assets dir mapping
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]