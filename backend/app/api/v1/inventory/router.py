from fastapi import APIRouter

from . import controller
from .schema import BatchResponse, PlatformOrderResponse, ProductResponse, RawMaterialResponse

router = APIRouter()

# Products
router.get("/products", response_model=list[ProductResponse])(controller.list_products)
router.post("/products", response_model=ProductResponse)(controller.create_product)
router.get("/products/export")(controller.export_products)
router.get("/products/sample")(controller.products_sample)
router.post("/products/import")(controller.import_products)
router.get("/products/{product_id}", response_model=ProductResponse)(controller.get_product)
router.post("/products/{product_id}/adjust-stock", response_model=ProductResponse)(controller.adjust_stock)

# Raw Materials
router.get("/raw-materials", response_model=list[RawMaterialResponse])(controller.list_raw_materials)
router.post("/raw-materials", response_model=RawMaterialResponse)(controller.create_raw_material)
router.get("/raw-materials/export")(controller.export_raw_materials)
router.get("/raw-materials/sample")(controller.raw_materials_sample)
router.post("/raw-materials/import")(controller.import_raw_materials)
router.patch("/raw-materials/{material_id}/adjust", response_model=RawMaterialResponse)(controller.adjust_raw_material)

# Batches
router.get("/batches", response_model=list[BatchResponse])(controller.list_batches)
router.post("/batches", response_model=BatchResponse)(controller.create_batch)
router.patch("/batches/{batch_id}/status", response_model=BatchResponse)(controller.update_batch_status)

# Platform Orders
router.get("/platform-orders", response_model=list[PlatformOrderResponse])(controller.list_platform_orders)
router.post("/platform-orders", response_model=PlatformOrderResponse)(controller.create_platform_order)
router.get("/platform-orders/export")(controller.export_platform_orders)
router.get("/platform-orders/sample")(controller.platform_orders_sample)
router.post("/platform-orders/import")(controller.import_platform_orders)
router.get("/platform-summary")(controller.platform_summary)
