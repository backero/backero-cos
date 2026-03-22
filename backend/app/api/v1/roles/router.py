from fastapi import APIRouter

from . import controller
from .schema import RoleResponse

router = APIRouter()

router.add_api_route("/",          controller.list_roles,   methods=["GET"],    response_model=list[RoleResponse])
router.add_api_route("/",          controller.create_role,  methods=["POST"],   response_model=RoleResponse, status_code=201)
router.add_api_route("/{role_id}", controller.update_role,  methods=["PUT"],    response_model=RoleResponse)
router.add_api_route("/{role_id}", controller.delete_role,  methods=["DELETE"])
