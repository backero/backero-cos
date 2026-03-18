from fastapi import APIRouter

from . import controller
from .schema import BatchResponse, PlatformOrderResponse, ProductResponse, RawMaterialResponse

router = APIRouter()

router.get("/products", response_model=list[ProductResponse])(controller.list_products)
router.post("/products", response_model=ProductResponse)(controller.create_product)
router.get("/products/{product_id}", response_model=ProductResponse)(controller.get_product)
router.post("/products/{product_id}/adjust-stock", response_model=ProductResponse)(controller.adjust_stock)
router.get("/raw-materials", response_model=list[RawMaterialResponse])(controller.list_raw_materials)
router.post("/raw-materials", response_model=RawMaterialResponse)(controller.create_raw_material)
router.patch("/raw-materials/{material_id}/adjust", response_model=RawMaterialResponse)(controller.adjust_raw_material)
router.get("/batches", response_model=list[BatchResponse])(controller.list_batches)
router.post("/batches", response_model=BatchResponse)(controller.create_batch)
router.patch("/batches/{batch_id}/status", response_model=BatchResponse)(controller.update_batch_status)
router.get("/platform-orders", response_model=list[PlatformOrderResponse])(controller.list_platform_orders)
router.post("/platform-orders", response_model=PlatformOrderResponse)(controller.create_platform_order)
router.get("/platform-summary")(controller.platform_summary)
