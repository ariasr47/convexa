use axum::{
    handler::Handler,
    routing::{delete, get, head, options, patch, post, put, trace, MethodRouter},
    Router,
};
use utoipa::openapi::{
    info::{ContactBuilder, InfoBuilder, LicenseBuilder},
    path::{HttpMethod, Operation, PathItem, Paths},
    schema::{Components, Schema},
    OpenApi, RefOr,
};

#[derive(Debug, thiserror::Error)]
pub enum ContractGraphError {
    #[error("unsupported or empty HTTP method metadata for {handler}")]
    UnsupportedOrEmptyMethod { handler: &'static str },
    #[error("duplicate path-method registration for {method} {path}")]
    DuplicatePathMethod { method: &'static str, path: String },
    #[error("duplicate operation identity {operation_id}")]
    DuplicateOperationId { operation_id: String },
}

pub struct ContractRouter<S> {
    router: Router<S>,
    openapi: OpenApi,
}

pub(crate) struct RoutePackage<S> {
    path: String,
    methods: Vec<HttpMethod>,
    operation: Operation,
    schemas: Vec<(String, RefOr<Schema>)>,
    method_router: MethodRouter<S>,
}

fn method_name(method: &HttpMethod) -> &'static str {
    match method {
        HttpMethod::Get => "GET",
        HttpMethod::Put => "PUT",
        HttpMethod::Post => "POST",
        HttpMethod::Delete => "DELETE",
        HttpMethod::Options => "OPTIONS",
        HttpMethod::Head => "HEAD",
        HttpMethod::Patch => "PATCH",
        HttpMethod::Trace => "TRACE",
    }
}

fn route_method<S, T, H>(methods: &[HttpMethod], handler: H) -> MethodRouter<S>
where
    H: Handler<T, S> + Clone + Send + Sync + 'static,
    T: 'static,
    S: Clone + Send + Sync + 'static,
{
    let mut router = MethodRouter::new();
    for method in methods {
        router = match method {
            HttpMethod::Get => router.merge(get(handler.clone())),
            HttpMethod::Put => router.merge(put(handler.clone())),
            HttpMethod::Post => router.merge(post(handler.clone())),
            HttpMethod::Delete => router.merge(delete(handler.clone())),
            HttpMethod::Options => router.merge(options(handler.clone())),
            HttpMethod::Head => router.merge(head(handler.clone())),
            HttpMethod::Patch => router.merge(patch(handler.clone())),
            HttpMethod::Trace => router.merge(trace(handler.clone())),
        };
    }
    router
}

pub(crate) fn package_from_metadata<S, T, H>(
    handler_name: &'static str,
    metadata_path: String,
    methods: Vec<HttpMethod>,
    operation: Operation,
    schemas: Vec<(String, RefOr<Schema>)>,
    handler: H,
) -> Result<RoutePackage<S>, ContractGraphError>
where
    H: Handler<T, S> + Clone + Send + Sync + 'static,
    T: 'static,
    S: Clone + Send + Sync + 'static,
{
    if methods.is_empty() {
        return Err(ContractGraphError::UnsupportedOrEmptyMethod {
            handler: handler_name,
        });
    }
    let path = if metadata_path.is_empty() {
        "/".to_owned()
    } else {
        metadata_path
    };
    Ok(RoutePackage {
        path,
        methods: methods.clone(),
        operation,
        schemas,
        method_router: route_method(&methods, handler),
    })
}

impl<S: Clone + Send + Sync + 'static> ContractRouter<S> {
    pub fn new() -> Self {
        let contact = ContactBuilder::new()
            .name(Some("Juha Kukkonen"))
            .email(Some("juha7kukkonen@gmail.com"))
            .build();
        let license = LicenseBuilder::new()
            .name("MIT OR Apache-2.0")
            .identifier(Some("MIT OR Apache-2.0"))
            .build();
        let info = InfoBuilder::new()
            .title("utoipa-axum")
            .version("0.2.0")
            .description(Some(
                "Utoipa's axum bindings for seamless integration for the two",
            ))
            .contact(Some(contact))
            .license(Some(license))
            .build();
        Self {
            router: Router::new(),
            openapi: OpenApi::new(info, Paths::new()),
        }
    }

    pub(crate) fn route(mut self, package: RoutePackage<S>) -> Result<Self, ContractGraphError> {
        for method in &package.methods {
            let name = method_name(method);
            if self
                .openapi
                .paths
                .get_path_operation(&package.path, method.clone())
                .is_some()
            {
                return Err(ContractGraphError::DuplicatePathMethod {
                    method: name,
                    path: package.path.clone(),
                });
            }
        }
        if let Some(id) = package.operation.operation_id.clone() {
            for path in self.openapi.paths.paths.values() {
                for op in [
                    &path.get,
                    &path.put,
                    &path.post,
                    &path.delete,
                    &path.options,
                    &path.head,
                    &path.patch,
                    &path.trace,
                ]
                .into_iter()
                .flatten()
                {
                    if op.operation_id.as_ref() == Some(&id) {
                        return Err(ContractGraphError::DuplicateOperationId { operation_id: id });
                    }
                }
            }
        }
        let item = PathItem::from_http_methods(package.methods.clone(), package.operation);
        self.openapi
            .paths
            .paths
            .entry(package.path.clone())
            .or_default()
            .merge_operations(item);
        let components = self.openapi.components.get_or_insert_with(Components::new);
        for (name, schema) in package.schemas {
            components.schemas.insert(name, schema);
        }
        self.router = self.router.route(&package.path, package.method_router);
        Ok(self)
    }

    pub fn split_for_parts(self) -> (Router<S>, OpenApi) {
        (self.router, self.openapi)
    }
}

macro_rules! contract_route {
    ($handler:path, $metadata:path) => {{
        use utoipa::{
            __dev::{SchemaReferences, Tags},
            Path,
        };
        let methods = <$metadata as Path>::methods();
        let mut operation = <$metadata as Path>::operation();
        let tags = <$metadata as Tags>::tags();
        if !tags.is_empty() {
            operation
                .tags
                .get_or_insert_with(Vec::new)
                .extend(tags.into_iter().map(str::to_owned));
        }
        let mut schemas = Vec::new();
        <$metadata as SchemaReferences>::schemas(&mut schemas);
        $crate::routes::contract_router::package_from_metadata(
            stringify!($handler),
            <$metadata as Path>::path(),
            methods,
            operation,
            schemas,
            $handler,
        )
    }};
}
pub(crate) use contract_route;

#[cfg(test)]
mod tests {
    use super::*;

    async fn test_handler() -> &'static str {
        "ok"
    }

    #[test]
    fn empty_metadata_methods_fail_before_graph_mutation() {
        let operation = utoipa::openapi::path::OperationBuilder::new().build();
        let result = package_from_metadata::<(), _, _>(
            "test_handler",
            "/test".to_owned(),
            Vec::new(),
            operation,
            Vec::new(),
            test_handler,
        );
        assert!(matches!(
            result,
            Err(ContractGraphError::UnsupportedOrEmptyMethod { .. })
        ));
    }

    #[test]
    fn duplicate_path_method_is_rejected_without_partial_graph() {
        let operation = utoipa::openapi::path::OperationBuilder::new()
            .operation_id(Some("one"))
            .build();
        let first = package_from_metadata::<(), _, _>(
            "first",
            "/same".to_owned(),
            vec![HttpMethod::Get],
            operation,
            Vec::new(),
            test_handler,
        )
        .unwrap();
        let operation = utoipa::openapi::path::OperationBuilder::new()
            .operation_id(Some("two"))
            .build();
        let second = package_from_metadata::<(), _, _>(
            "second",
            "/same".to_owned(),
            vec![HttpMethod::Get],
            operation,
            Vec::new(),
            test_handler,
        )
        .unwrap();
        let graph = ContractRouter::<()>::new().route(first).unwrap();
        let result = graph.route(second);
        assert!(
            matches!(result, Err(ContractGraphError::DuplicatePathMethod { method: "GET", path }) if path == "/same")
        );
    }

    #[test]
    fn duplicate_operation_identity_is_rejected_before_route_install() {
        let make = |handler: &'static str, path: &'static str| {
            let operation = utoipa::openapi::path::OperationBuilder::new()
                .operation_id(Some("same_identity"))
                .build();
            package_from_metadata::<(), _, _>(
                handler,
                path.to_owned(),
                vec![HttpMethod::Post],
                operation,
                Vec::new(),
                test_handler,
            )
            .unwrap()
        };
        let graph = ContractRouter::<()>::new()
            .route(make("first", "/first"))
            .unwrap();
        let result = graph.route(make("second", "/second"));
        assert!(
            matches!(result, Err(ContractGraphError::DuplicateOperationId { operation_id }) if operation_id == "same_identity")
        );
    }
}
