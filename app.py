from flask import Flask, request, jsonify, send_from_directory, url_for
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import os
import re
import json
import time
import uuid
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from datetime import datetime

# Create static folder structure
STATIC_FOLDER = 'static'
CSS_FOLDER = os.path.join(STATIC_FOLDER, 'css')
JS_FOLDER = os.path.join(STATIC_FOLDER, 'js')
FIGURES_FOLDER = os.path.join(STATIC_FOLDER, 'figures')
IMAGES_FOLDER = os.path.join(FIGURES_FOLDER, 'images')

# Ensure all directories exist
for folder in [STATIC_FOLDER, CSS_FOLDER, JS_FOLDER, FIGURES_FOLDER, IMAGES_FOLDER]:
    os.makedirs(folder, exist_ok=True)

app = Flask(__name__, static_folder=STATIC_FOLDER)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///figures.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
CORS(app)  # Enable CORS for all routes
db = SQLAlchemy(app)

# Database models
class Figure(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True, nullable=False)
    url = db.Column(db.String(500), nullable=False)
    name = db.Column(db.String(200))
    price = db.Column(db.String(100))
    release_date = db.Column(db.String(100))
    release_year = db.Column(db.String(4))
    scale = db.Column(db.String(50))
    manufacturer = db.Column(db.String(100))
    character = db.Column(db.String(100))
    series = db.Column(db.String(100))
    dimensions = db.Column(db.String(100))
    image_path = db.Column(db.String(200))
    status = db.Column(db.String(20), default='tracking')  # 'tracking', 'preordered', or 'purchased'
    actual_price = db.Column(db.Float, default=0.0)  # Current market price or purchase price
    remaining_payment = db.Column(db.Float, default=0.0)  # Remaining payment for preordered items
    scrape_date = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'uuid': self.uuid,
            'url': self.url,
            '名称': self.name.removeprefix("中文名称：明日方舟"),
            '定价': self.price,
            '发售日': self.release_date,
            '发售年份': self.release_year,
            '比例': self.scale,
            '制作': self.manufacturer,
            '角色': self.character,
            '作品': self.series,
            '尺寸': self.dimensions,
            'main_image': self.image_path,
            'status': self.status,
            'actual_price': self.actual_price,
            'remaining_payment': self.remaining_payment,
            'scrape_date': self.scrape_date.strftime('%Y-%m-%d %H:%M:%S')
        }

class HpoiScraper:
    def __init__(self, save_dir=FIGURES_FOLDER):
        """Initialize the scraper with a directory to save data."""
        self.save_dir = save_dir
        self.img_dir = IMAGES_FOLDER
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        # Create directories if they don't exist
        os.makedirs(self.save_dir, exist_ok=True)
        os.makedirs(self.img_dir, exist_ok=True)
    
    def download_image(self, img_url, filename=None):
        """Download an image and save it to the images directory."""
        if not img_url:
            return None
        
        # Handle relative URLs
        if not urlparse(img_url).netloc:
            img_url = urljoin("https://www.hpoi.net/", img_url)
        
        try:
            response = requests.get(img_url, headers=self.headers, stream=True)
            response.raise_for_status()
            
            # Generate unique filename with timestamp and original name
            if not filename:
                ext = os.path.splitext(urlparse(img_url).path)[1]
                if not ext:
                    ext = '.jpg'
                filename = f"figure_{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
            
            filepath = os.path.join(self.img_dir, filename)
            
            # Save the image
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            return f"/figures/images/{filename}"  # Return path that works for frontend
        except Exception as e:
            print(f"Error downloading image from {img_url}: {e}")
            return None
    
    def scrape_preview(self, url):
        """Scrape figure information from URL without saving to database."""
        try:
            # Get the webpage content
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Generate unique identifier
            figure_uuid = str(uuid.uuid4())
            
            # Extract figure data - only include url as requested
            figure_data = {
                'uuid': figure_uuid,
                'url': url
            }
            
            # Extract title (名称)
            title_elem = soup.select_one('.hpoi-ibox-title p')
            if title_elem:
                figure_data['名称'] = title_elem.get_text(strip=True)
            
            # Extract main image only - use UUID in filename to ensure uniqueness
            main_img = soup.select_one('.hpoi-ibox-img img')
            if main_img and main_img.get('src'):
                safe_name = ""
                if '名称' in figure_data:
                    # Create a safe filename from title
                    safe_name = re.sub(r'[^\w\s-]', '', figure_data['名称'])
                    safe_name = re.sub(r'[\s-]+', '_', safe_name)
                    
                image_filename = f"{safe_name}_{figure_uuid[:8]}.jpg"
                img_path = self.download_image(main_img['src'], image_filename)
                if img_path:
                    figure_data['main_image'] = img_path
            
            # Extract only the requested fields from the info box
            # Fields to extract: 定价, 发售日, 比例, 制作, 角色, 作品, 尺寸
            requested_fields = ['定价', '发售日', '比例', '制作', '角色', '作品', '尺寸']
            info_items = soup.select('.infoList-box .hpoi-infoList-item')
            
            for item in info_items:
                label = item.select_one('span')
                value = item.select_one('p')
                if label and value:
                    key = label.get_text(strip=True)
                    if key in requested_fields:
                        figure_data[key] = value.get_text(strip=True)
                        
                        # Extract release year from 发售日 field
                        if key == '发售日':
                            release_text = value.get_text(strip=True)
                            year_match = re.search(r'(\d{4})年', release_text)
                            if year_match:
                                figure_data['发售年份'] = year_match.group(1)
            
            # Add default values for status
            figure_data['status'] = 'tracking'
            figure_data['actual_price'] = 0.0
            figure_data['remaining_payment'] = 0.0
            
            return figure_data
            
        except Exception as e:
            print(f"Error scraping figure from {url}: {e}")
            return {'error': str(e)}
            
    def scrape_figure(self, url, data):
        """Scrape figure information and save to database (called after confirmation)."""
        try:
            # Create a new figure in the database
            figure = Figure(
                uuid=data['uuid'],
                url=url,
                name=data.get('名称', ''),
                price=data.get('定价', ''),
                release_date=data.get('发售日', ''),
                release_year=data.get('发售年份', ''),
                scale=data.get('比例', ''),
                manufacturer=data.get('制作', ''),
                character=data.get('角色', ''),
                series=data.get('作品', ''),
                dimensions=data.get('尺寸', ''),
                image_path=data.get('main_image', ''),
                status=data.get('status', 'tracking'),
                actual_price=float(data.get('actual_price', 0.0)),
                remaining_payment=float(data.get('remaining_payment', 0.0))
            )
            
            db.session.add(figure)
            db.session.commit()
            
            # Add database ID to response
            data['id'] = figure.id
            
            return data
            
        except Exception as e:
            print(f"Error saving figure to database: {e}")
            return {'error': str(e)}

# Initialize the scraper
scraper = HpoiScraper()

@app.route('/api/figures/save', methods=['POST'])
def save_figure():
    """API endpoint to save figure data to database after confirmation."""
    data = request.json
    
    if not data or 'url' not in data or 'uuid' not in data:
        return jsonify({'error': 'URL and UUID are required'}), 400
    
    url = data['url']
    if not url.startswith('http'):
        url = 'https://' + url
    
    # Check if the URL is already in database
    existing_figure = Figure.query.filter_by(url=url).first()
    if existing_figure:
        return jsonify(existing_figure.to_dict())
    
    # Save to database
    result = scraper.scrape_figure(url, data)
    return jsonify(result)

@app.route('/api/scrape', methods=['POST'])
def scrape_figure():
    """API endpoint to scrape figure data from a URL (without saving to database)."""
    data = request.json
    
    if not data or 'url' not in data:
        return jsonify({'error': 'URL is required'}), 400
    
    url = data['url']
    if not url.startswith('http'):
        url = 'https://' + url
    
    # Check if the URL is already in database
    existing_figure = Figure.query.filter_by(url=url).first()
    if existing_figure:
        return jsonify(existing_figure.to_dict())
    
    # Just scrape the data without saving to the database
    result = scraper.scrape_preview(url)
    return jsonify(result)

@app.route('/api/figures/<uuid>', methods=['GET'])
def get_figure(uuid):
    """API endpoint to get figure data by UUID."""
    figure = Figure.query.filter_by(uuid=uuid).first()
    if not figure:
        return jsonify({'error': 'Figure not found'}), 404
    
    return jsonify(figure.to_dict())

@app.route('/api/figures', methods=['GET'])
def list_figures():
    """API endpoint to list all saved figures."""
    figures = Figure.query.order_by(Figure.scrape_date.desc()).all()
    return jsonify([figure.to_dict() for figure in figures])

@app.route('/api/figures/update/<uuid>', methods=['POST'])
def update_figure(uuid):
    """API endpoint to update figure with flexible field updates."""
    data = request.json
    figure = Figure.query.filter_by(uuid=uuid).first()
    
    if not figure:
        return jsonify({'error': 'Figure not found'}), 404
    
    try:
        # 定义可更新的字段映射
        field_mapping = {
            'status': 'status',
            'actual_price': 'actual_price',
            'remaining_payment': 'remaining_payment',
            '发售年份': 'release_year',
            '角色': 'character'
        }
        
        # 更新支持的字段
        for input_key, model_attr in field_mapping.items():
            if input_key in data:
                value = data[input_key]
                
                # 特殊处理数值类型的字段
                if input_key in ['actual_price', 'remaining_payment']:
                    value = float(value)
                else:
                    # 其他字段转换为字符串
                    value = str(value)
                
                # 使用 setattr 动态设置属性
                setattr(figure, model_attr, value)
        
        db.session.commit()
        
        return jsonify(figure.to_dict())
    
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': '无效的数据格式：' + str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': '更新失败：' + str(e)}), 500
    
    except ValueError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Update failed'}), 500


# Route to serve index.html for the main scraper page
@app.route('/')
def index():
    return send_from_directory(STATIC_FOLDER, 'index.html')

# Route to serve list.html for the figures list page
@app.route('/list')
def list_page():
    return send_from_directory(STATIC_FOLDER, 'list.html')

# Generic route to serve any static files
@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# Special route to handle JS files in the js folder
@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(JS_FOLDER, filename)

# Special route to handle CSS files in the css folder
@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory(CSS_FOLDER, filename)



# Route to serve stats.html for the statistics page
@app.route('/stats')
def stats_page():
    return send_from_directory(STATIC_FOLDER, 'stats.html')


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)