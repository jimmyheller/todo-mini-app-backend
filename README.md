# Todo Application Setup and Monitoring Guide

## System Requirements
- Ubuntu Server
- Node.js
- Nginx
- MongoDB
- Redis

## Initial Server Setup

### 1. System Updates
```bash
sudo apt update
sudo apt upgrade -y
```

### 2. MongoDB Setup
```bash
# Import MongoDB public key
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg \
   --dearmor

# Create list file for MongoDB
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Update package database
sudo apt update

# Install MongoDB
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl enable mongod
sudo systemctl start mongod

# Configure MongoDB to listen on localhost only
sudo nano /etc/mongod.conf
# Set: bindIp: 127.0.0.1

# Restart MongoDB
sudo systemctl restart mongod
```

### 3. Redis Setup
```bash
# Install Redis
sudo apt install redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set the following:
# bind 127.0.0.1
# protected-mode no

# Start and enable Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### 4. Nginx Setup
```bash
# Install Nginx
sudo apt install nginx

# Create SSL directory
sudo mkdir -p /etc/nginx/ssl

# Copy SSL certificates
sudo cp /path/to/origin.pem /etc/nginx/ssl/cert.pem
sudo cp /path/to/private.pem /etc/nginx/ssl/key.pem

# Set proper permissions
sudo chmod 600 /etc/nginx/ssl/*.pem

# Backup default configuration
sudo mv /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# Create new Nginx configuration
sudo nano /etc/nginx/nginx.conf
```

Nginx configuration:
```nginx
events {
    worker_connections 1024;
}

http {
    log_format detailed_log '$remote_addr - $remote_user [$time_local] '
                            '"$request" $status $body_bytes_sent '
                            '"$http_referer" "$http_user_agent" '
                            'upstream_addr="$upstream_addr" '
                            'upstream_status="$upstream_status" '
                            'upstream_response_time="$upstream_response_time"';

    server {
        listen 80;
        listen [::]:80;
        server_name todo.robotalife.com;
        
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name todo.robotalife.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        access_log /var/log/nginx/access.log detailed_log;
        error_log /var/log/nginx/error.log debug;

        location /api {
            proxy_pass http://127.0.0.1:5000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }
    }
}
```

### 5. Application Setup
```bash
# Create application directory
sudo mkdir -p /opt/todo-app

# Copy application files
sudo cp -r /path/to/backend/* /opt/todo-app/

# Install dependencies
cd /opt/todo-app
npm install
npm run build

# Create systemd service
sudo nano /etc/systemd/system/todo-app.service
```

Service configuration:
```ini
[Unit]
Description=Todo App Backend
After=network.target mongod.service redis-server.service

[Service]
Environment=NODE_ENV=production
Environment=PORT=5000
Environment=MONGODB_URI=mongodb://127.0.0.1:27017/todo_db
Environment=REDIS_URL=redis://127.0.0.1:6379
Environment=BOT_TOKEN=your_bot_token_here
Type=simple
User=root
WorkingDirectory=/opt/todo-app
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 6. Firewall Configuration
```bash
# Enable UFW
sudo ufw enable

# Configure UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https

# Check UFW status
sudo ufw status numbered
```

## Service Management

### Start Services
```bash
sudo systemctl start mongod
sudo systemctl start redis-server
sudo systemctl start nginx
sudo systemctl start todo-app
```

### Enable Services (Auto-start)
```bash
sudo systemctl enable mongod
sudo systemctl enable redis-server
sudo systemctl enable nginx
sudo systemctl enable todo-app
```

### Check Service Status
```bash
sudo systemctl status mongod
sudo systemctl status redis-server
sudo systemctl status nginx
sudo systemctl status todo-app
```

## Monitoring and Logs

### Application Logs
```bash
# Todo app logs
sudo journalctl -u todo-app -f

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

### Service Health Checks
```bash
# Check listening ports
sudo netstat -tulnp | grep -E '80|443|5000|27017|6379'

# MongoDB connection test
mongosh --eval "db.serverStatus()"

# Redis connection test
redis-cli ping

# Application health check
curl -k https://todo.robotalife.com/api/health
```

## Troubleshooting

### Common Commands
```bash
# Restart specific service
sudo systemctl restart [service-name]

# Check service logs
sudo journalctl -u [service-name] -f

# Check system resources
htop

# Check disk space
df -h

# Check memory usage
free -m
```

### Service Dependencies
- MongoDB must be running before the application starts
- Redis must be running before the application starts
- Nginx requires the application to be running for API proxying

Remember to replace placeholders like `your_bot_token_here` with actual values before using the commands.